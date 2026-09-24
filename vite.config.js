import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const manifest = {
	theme_color: '#ff9e42',
	background_color: '#ffffff',
	icons: [
		{
			purpose: 'maskable',
			sizes: '512x512',
			src: 'icon512_maskable.png',
			type: 'image/png',
		},
		{
			purpose: 'any',
			sizes: '512x512',
			src: 'icon512_rounded.png',
			type: 'image/png',
		},
	],
	screenshots: [
		{
			src: '/screenshots/desctop.png',
			type: 'image/png',
			sizes: '1900x940',
			form_factor: 'wide',
		},
		{
			src: '/screenshots/mobile.png',
			type: 'image/png',
			sizes: '264x840',
			form_factor: 'narrow',
		},
	],
	orientation: 'any',
	display: 'standalone',
	dir: 'auto',
	lang: 'ru',
};

// https://vite.dev/config/
export default defineConfig({
	plugins: [
		react(),
		VitePWA({
			registerType: 'autoUpdate',
			workbox: {
				globPatterns: ['**/*{html, css, js, ico, webp, png, svg}'],
			},
			manifest: manifest,
		}),
	],
	base: '/MAK/',
});
