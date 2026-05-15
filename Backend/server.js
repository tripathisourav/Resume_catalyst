require('dotenv').config();
const app = require('./src/app');

const connectDB = require('./src/config/database');
// const invokeGemini = require('./src/services/ai.service')



connectDB();
// invokeGemini()

app.listen(3000, () => {
  console.log('Server is running on port 3000');
});