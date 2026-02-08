import { defineConfig } from "docia";

export default defineConfig({
	srcDir: "src",
	outDir: "book",
	basePath: "/workspace-utils/",
	site: {
		title: "workspace-utils",
		description:
			"A CLI tool to orchestrate scripts across monorepo workspaces with parallel execution and dependency-aware builds",
		language: "en",
		url: "https://torstendittmann.github.io/workspace-utils",
		socials: {
			github: "https://github.com/TorstenDittmann/workspace-utils",
		},
		githubEditBranch: "main",
		githubEditPath: "docs/src",
	},
});
