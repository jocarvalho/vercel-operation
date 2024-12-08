const express = require('express');
const B2 = require('backblaze-b2');
const fs = require('fs');
const path = require('path');
var bodyParser = require('body-parser');
const dotenv = require('dotenv');
dotenv.config();

const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({limit: '5mb', extended: true}));


console.log(process.env)
// Configure suas credenciais da Backblaze
const b2 = new B2({
  accountId: process.env.B2_ACCOUNT,
  applicationKey: process.env.B2_TOKEN,
});

// Conectar-se à Backblaze
b2.authorize()
  .then((auth) => {
    console.log('Conectado à Backblaze B2', auth.data);
  })
  .catch(err => {
    console.error('Erro de autorização:', err);
  });

  
  app.post('/post-file', (req, res) =>{
    console.log(req.body)
    const fileName = req.body.fileName;


    b2.getUploadUrl({
        bucketId: 'a2ba2e37a0b730358a99091c',
    }).then((response) => {
        console.log(
            "getUploadUrl",
            response.data.uploadUrl
        );
        b2.uploadFile({
            bucketId: 'somos-impar-assets',
            uploadAuthToken: response.data.authorizationToken,
            uploadUrl:response.data.uploadUrl,
            fileName: fileName,
            data: fs.readFileSync(fileName)
          })
            .then(response => {
                console.log(response);
                res.status(200).send(response.data);
            })
            .catch(err => {
              console.error('Erro durante o upload para a Backblaze B2:', err);
              res.status(500).send('Erro interno no servidor');
            });
    }).catch(console.error);

});
  

// Rota para baixar um arquivo da Backblaze B2
app.get('/download', (req, res) => {
  const fileName = req.query.file;
  console.log(fileName)
  b2.downloadFileByName({
    bucketName: 'somos-impar-assets',
    fileName: fileName,
    responseType: 'arraybuffer'
  })
    .then(response => {
        res.setHeader('Content-Type', response.headers['content-type']);
        res.status(200).send(response.data)
    })
    .catch(err => {
      console.error('Erro durante o download da Backblaze B2:', err);
      res.status(500).send('Erro interno no servidor');
    });
});

app.delete('/delete-file', async (req, res) => {
  const fileName = req.body.fileName;
  const fileId = req.body.fileId;
  b2.deleteFileVersion({
    fileName: fileName,
    fileId:fileId
  })
    .then(response => {
        res.setHeader('Content-Type', response.headers['content-type']);
        res.status(200).send(response.data)
    })
    .catch(err => {
      console.error('Erro durante o download da Backblaze B2:', err);
      res.status(500).send('Erro interno no servidor');
    });
});

app.listen(process.env.PORT || 8080);

module.exports = app;
