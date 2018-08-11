docs/bugout.min.js: index.js
	npm run minifiy
	mv bugout.min.js docs/

bugout.js: index.js
	npm run build
