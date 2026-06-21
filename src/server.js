const app = require('./app');
const { port } = require('./config/env');

app.listen(port, () => {
  console.log(`DueTrack API listening on port ${port}`);
});
