docs/bugout.min.js: bugout.js
	npm run minify

bugout.js: index.js $(shell find ./node_modules -type f -name '*.js' | sed 's/ /\\ /g') node_modules
	npm run compile

node_modules:
	npm install

test: test.log

test.log: bugout.js test.js
	node test.js > test.log
