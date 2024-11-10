const express = require('express');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const { createCollections, createIndexes} = require('./database');
const pageroutes = require('./page_routes');
const apiroutes = require('./api_routes.js');

const path = require('path');
const app = express();

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cookieParser());

// Register routes
app.use('/', pageroutes);
app.use('/',apiroutes);

// 404 Page
app.get('/404',(req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'view', '404.html'));
});

app.use((req, res) => {
  res.redirect('/404');
});

// Start the server
const port = 3000;
app.listen(port, async () => {
  console.log(`Server is listening on port ${port}`);
  await createCollections();
  await createIndexes();
});
