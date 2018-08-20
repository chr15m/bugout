docs/bugout.min.js: bugout.js
	npm run minify

bugout.js: index.js $(shell find ./node_modules -type f -name '*.js')
	npm run compile
