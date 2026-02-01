await Bun.build({
	entrypoints: ["index.ts"],
	outdir: "dist",
	minify: true,
	target: "node",
});

