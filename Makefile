docs/bugout.min.js: bugout.min.js
	cp $< $@

bugout.min.js: index.js
	npm run minifiy

bugout.js: index.js
	npm run build
