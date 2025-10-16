import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
export const { name } = JSON.parse(
	readFileSync(resolve(__dirname, "package.json"), "utf-8"),
);
export const pascalName = hyphenToPascal(name);

export default defineConfig({
	plugins: [vue()],
	build: {
		lib: {
			cssFileName: name,
			entry: {
				[name]: resolve(__dirname, "src/index.vue"),
			},
			name: pascalName,
		},
		rollupOptions: {
			external: ["vue"],
			output: {
				globals: {
					vue: "Vue",
				},
			},
		},
	},
});

function hyphenToCamel(str: string) {
	return str.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
}

function hyphenToPascal(str: string) {
	const camel = hyphenToCamel(str);
	return camel.charAt(0).toUpperCase() + camel.slice(1);
}
