import {rollupDebugPlugins, writeNollupBundle} from "../buildSrc/RollupDebugConfig.js"
import nollup from "nollup"
import * as env from "../buildSrc/env.js"
import {promises as fs} from "fs"
import path from "path"
import {renderHtml} from "../buildSrc/LaunchHtml.js"

export async function build(options, log) {
	log("Build")

	const localEnv = env.create("localhost:9000", "unit-test", "Test")

	log("Bundling...")
	const bundle = await nollup({
		input: ["api/bootstrapTests-api.js", "client/bootstrapTests-client.js"],
		plugins: [
			envPlugin(localEnv),
			resolveTestLibsPlugin(),
			...rollupDebugPlugins(".."),
			// graph({output: "graph.dot", prune: true}),
		],
	})
	return [
		{
			bundle,
			async generate() {
				await Promise.all([
					createUnitTestHtml(false, "api", localEnv),
					createUnitTestHtml(false, "client", localEnv)
				])

				const start = Date.now()
				log("Generating...")
				const result = await bundle.generate({sourcemap: false, dir: "../build/test", format: "esm"})
				log("Generated in", Date.now() - start)

				const writingStart = Date.now()
				await writeNollupBundle(result, log, "../build/test")
				log("Wrote in ", Date.now() - writingStart)
			},
		}
	]
}

// We use this homebrew plugin so that libs are copies to _virtual folder and *not* build/node_modules
// (which would be the case with preserve_modules).
// Files in build/node_modules are treated as separate libraries and ES mode resets back to commonjs.
function resolveTestLibsPlugin() {
	return {
		name: "resolve-test-libs",
		resolveId(source) {
			switch (source) {
				case "mithril/test-utils/browserMock":
					// This one is *not* a module, just a script so we need to rewrite import path.
					// nollup only rewrites absolute paths so resolve path first.
					return path.resolve("../node_modules/mithril/test-utils/browserMock.js")
				case "ospec":
					return ("../node_modules/ospec/ospec.js")
				case "bluebird":
					return "../node_modules/bluebird/js/browser/bluebird.js"
				case "util":
				case "crypto":
				case "xhr2":
				case "express":
				case "server-destroy":
				case "body-parser":
					return false
			}
		}
	}
}


/**
 * Simple plugin for virtual module "@tutanota/env" which resolves to the {@param env}.
 * see https://rollupjs.org/guide/en/#a-simple-example
 */
function envPlugin(env) {
	return {
		name: "tutanota-env",
		resolveId(source) {
			if (source === "@tutanota/env") return source
		},
		load(id) {
			if (id === "@tutanota/env") return `export default ${JSON.stringify(env)}`
		},
	}
}

async function createUnitTestHtml(watch, project, localEnv) {
	let imports = [`test-${project}.js`]

	const template = `import('./bootstrapTests-${project}.js')`
	await _writeFile(`../build/test/test-${project}.js`, [
		`window.whitelabelCustomizations = null`,
		`window.env = ${JSON.stringify(localEnv, null, 2)}`,
		watch ? "new WebSocket('ws://localhost:8080').addEventListener('message', (e) => window.hotReload())" : "",
	].join("\n") + "\n" + template)

	const html = await renderHtml(imports, localEnv)
	await _writeFile(`../build/test/test-${project}.html`, html)
}

function _writeFile(targetFile, content) {
	return fs.mkdir(path.dirname(targetFile), {recursive: true}).then(() => fs.writeFile(targetFile, content, 'utf-8'))
}