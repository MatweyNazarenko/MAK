export function formatDate(iso) {
  try {
    return new Intl.DateTimeFormat("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "";
  }
}

export function safeName(value) {
  return String(value)
    .replace(/[/:*?"<>|]+/g, "_")
    .replace(/\s+/g, "_")
    .slice(0, 70);
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = name;

  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function crcTable() {
  const table = [];

  for (let n = 0; n < 256; n += 1) {
    let value = n;

    for (let k = 0; k < 8; k += 1) {
      value =
        value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }

    table[n] = value >>> 0;
  }

  return table;
}

const CRC = crcTable();

function crc32(bytes) {
  let value = 0xffffffff;

  for (const byte of bytes) {
    value = CRC[(value ^ byte) & 255] ^ (value >>> 8);
  }

  return (value ^ 0xffffffff) >>> 0;
}

function u16(value) {
  return [value & 255, (value >>> 8) & 255];
}

function u32(value) {
  return [
    value & 255,
    (value >>> 8) & 255,
    (value >>> 16) & 255,
    (value >>> 24) & 255,
  ];
}

function dosDateTime(date = new Date()) {
  const time =
    (date.getHours() << 11) |
    (date.getMinutes() << 5) |
    (date.getSeconds() >> 1);

  const day =
    ((date.getFullYear() - 1980) << 9) |
    ((date.getMonth() + 1) << 5) |
    date.getDate();

  return [time, day];
}

function makeZip(entries) {
  const encoder = new TextEncoder();
  const chunks = [];
  const central = [];

  let offset = 0;

  const [time, date] = dosDateTime();

  entries.forEach(([name, source]) => {
    const nameBytes = encoder.encode(name);
    const data =
      typeof source === "string" ? encoder.encode(source) : source;

    const crc = crc32(data);

    const header = new Uint8Array([
      ...u32(0x04034b50),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(time),
      ...u16(date),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),
    ]);

    chunks.push(header, nameBytes, data);

    const centralHeader = new Uint8Array([
      ...u32(0x02014b50),
      ...u16(20),
      ...u16(20),
      ...u16(0),
      ...u16(0),
      ...u16(time),
      ...u16(date),
      ...u32(crc),
      ...u32(data.length),
      ...u32(data.length),
      ...u16(nameBytes.length),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u16(0),
      ...u32(0),
      ...u32(offset),
    ]);

    central.push(centralHeader, nameBytes);

    offset += header.length + nameBytes.length + data.length;
  });

  const centralSize = central.reduce(
    (sum, item) => sum + item.length,
    0,
  );

  const end = new Uint8Array([
    ...u32(0x06054b50),
    ...u16(0),
    ...u16(0),
    ...u16(entries.length),
    ...u16(entries.length),
    ...u32(centralSize),
    ...u32(offset),
    ...u16(0),
  ]);

  return new Blob([...chunks, ...central, end], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });
}

export function createDocxBlob(
  notes,
  title = "МАК для учителя — личная заметка",
) {
  const paragraphs = [];

  const paragraph = (text, bold = false, size = 24) => `
    <w:p>
      <w:r>
        <w:rPr>
          ${bold ? "<w:b/>" : ""}
          <w:sz w:val="${size}"/>
          <w:szCs w:val="${size}"/>
        </w:rPr>
        <w:t xml:space="preserve">${escapeXml(text)}</w:t>
      </w:r>
    </w:p>
  `;

  paragraphs.push(paragraph(title, true, 32));

  notes.forEach((note) => {
    paragraphs.push(paragraph(formatDate(note.date), false, 20));
    paragraphs.push(paragraph(`Карта: ${note.cardTitle}`, true, 24));

    if (note.section) {
      paragraphs.push(
        paragraph(`Раздел: ${note.section}`, false, 20),
      );
    }

    if (note.question) {
      paragraphs.push(
        paragraph(`Вопрос: ${note.question}`, true, 21),
      );
    }

    paragraphs.push(
      paragraph(
        note.type === "story" ? "Моя история:" : "Моя мысль:",
        true,
        21,
      ),
    );

    String(note.text || "—")
      .split(/\r?\n/)
      .forEach((part) => {
        paragraphs.push(paragraph(part || " ", false, 22));
      });

    paragraphs.push(
      paragraph("На сегодня достаточно.", false, 20),
    );

    paragraphs.push("<w:p/>");
  });

  const documentXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body>
        ${paragraphs.join("")}
        <w:sectPr>
          <w:pgSz w:w="11906" w:h="16838"/>
          <w:pgMar
            w:top="1134"
            w:right="1134"
            w:bottom="1134"
            w:left="1134"
          />
        </w:sectPr>
      </w:body>
    </w:document>`;

  return makeZip([
    [
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8"?>
      <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
        <Default
          Extension="rels"
          ContentType="application/vnd.openxmlformats-package.relationships+xml"
        />
        <Default
          Extension="xml"
          ContentType="application/xml"
        />
        <Override
          PartName="/word/document.xml"
          ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"
        />
      </Types>`,
    ],
    [
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8"?>
      <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
        <Relationship
          Id="rId1"
          Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument"
          Target="word/document.xml"
        />
      </Relationships>`,
    ],
    ["word/document.xml", documentXml],
  ]);
}

export function printNote(note) {
  const popup = window.open("", "_blank");

  if (!popup) {
    return false;
  }

  const escapeHtml = (value) =>
    String(value ?? "").replace(/[&<>"]/g, (symbol) => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
      };

      return entities[symbol];
    });

  popup.document.write(`
    <!doctype html>
    <html lang="ru">
      <head>
        <meta charset="UTF-8" />
        <title>${escapeHtml(note.cardTitle)}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            color: #332b25;
            max-width: 720px;
            margin: 50px auto;
            line-height: 1.55;
            padding: 20px;
          }

          h1 {
            font-family: Georgia, serif;
            font-weight: 400;
          }

          .box {
            border: 1px solid #d9cfbf;
            border-radius: 18px;
            padding: 22px;
            margin: 18px 0;
          }

          small {
            color: #776d63;
          }
        </style>
      </head>

      <body>
        <h1>МАК для учителя</h1>
        <small>${formatDate(note.date)}</small>

        <div class="box">
          <h2>${escapeHtml(note.cardTitle)}</h2>
          <p>${escapeHtml(note.section)}</p>

          <h3>Вопрос</h3>
          <p>${escapeHtml(note.question || "—")}</p>

          <h3>
            ${note.type === "story" ? "Моя история" : "Моя мысль"}
          </h3>

          <p style="white-space: pre-wrap">
            ${escapeHtml(note.text || "—")}
          </p>
        </div>

        <p><em>На сегодня достаточно.</em></p>

        <script>
          window.onload = () => {
            setTimeout(() => window.print(), 300);
          };
        <\/script>
      </body>
    </html>
  `);

  popup.document.close();

  return true;
}