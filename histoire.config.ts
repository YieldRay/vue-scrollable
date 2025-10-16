import { HstVue } from "@histoire/plugin-vue";
import { defineConfig } from "histoire";
import { name } from "./vite.config.ts";

export default defineConfig({
	plugins: [HstVue()],
	theme: {
		title: name,
	},
	vite: {
		base: "./",
	},
	routerMode: "hash",
});
