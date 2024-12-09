const express = require('express');
const B2 = require('backblaze-b2');
const fs = require('fs');
const path = require('path');
var bodyParser = require('body-parser');
const multer = require('multer');
const app = express();
const port = 4000;

app.use(bodyParser.json());
app.use(bodyParser.json({limit: '5mb'}));
app.use(bodyParser.urlencoded({limit: '5mb', extended: true}));

const b2 = new B2({
  accountId: process.env.B2_ACCOUNT,
  applicationKey: process.env.B2_TOKEN
});

let authorizationToken = null;
let apiUrl = null;
let tokenExpirationTime = null;
let uploadUrl = null;
let uploadAuthToken = null;

async function authenticateB2() {
  try {
    const authResponse = await b2.authorize();
    authorizationToken = authResponse.data.authorizationToken;
    apiUrl = authResponse.data.apiUrl;
    tokenExpirationTime = Date.now() + authResponse.expiresIn * 1000;
  } catch (error) {
    console.error('Erro na autenticação:', error);
    throw error;
  }
}

function isTokenExpired() {
  return Date.now() >= tokenExpirationTime;
}

async function ensureValidToken() {
  if (!authorizationToken || isTokenExpired()) {
    console.log('Token has expired or not found, do auth now...');
    await authenticateB2();
  }
}

app.use(async (req, res, next) => {
  try {
    await ensureValidToken();
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao garantir o token de autenticação' });
  }
});

app.get('/download', (req, res) => {
    const fileName = req.query.file;
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
        console.error(`Erro durante o download do ${fileName}`, err);
        res.status(500).send('internal server error');
      });
});
  
app.post('/post-file', (req, res) =>{
    const fileName = req.body.fileName;
    b2.getUploadUrl({
        bucketId: 'a2ba2e37a0b730358a99091c',
    }).then((response) => {
        b2.uploadFile({
            bucketId: 'somos-impar-assets',
            uploadAuthToken: authorizationToken,
            uploadUrl:apiUrl,
            fileName: fileName,
            data: fs.readFileSync(fileName)
          }).then(response => {
                console.log(response);
                res.status(200).send(response.data);
          }).catch(err => {
              let errorMsg = `Error on uploadfile: ${fileName}`
              console.error(errorMsg, err);
              res.status(500).send(errorMsg);
            });
    })
    .catch(console.error);
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
      console.error(`Error on delete file ${fileName}`, err);
      res.status(500).send('Erro interno no servidor');
    });
});


const upload = multer({ dest: 'uploads/' }); // Pasta temporária para armazenar o arquivo antes do upload

async function getUploadUrl(bucketId) {
  if (!uploadUrl || !uploadAuthToken) {
    const response = await b2.getUploadUrl({
      bucketId: bucketId
    });
    uploadUrl = response.data.uploadUrl;
    uploadAuthToken = response.data.authorizationToken;
  }

  return { uploadUrl, uploadAuthToken };
}


// Endpoint para upload de arquivo
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    const bucketId = 'a2ba2e37a0b730358a99091c';  // Substitua pelo seu Bucket ID
    const { uploadUrl, uploadAuthToken } = await getUploadUrl(bucketId);

    const filePath = path.join(__dirname, req.file.path); 

    // Fazendo o upload do arquivo
    const fileBuffer = fs.readFileSync(filePath);
    let fileName = filePath.substring(filePath.lastIndexOf('/')+1)
    console.log('fileName', fileName)
    
    
    const uploadResponse = await b2.uploadFile({
      uploadUrl: uploadUrl,
      uploadAuthToken: uploadAuthToken,
      fileName: fileName,
      data: fileBuffer
    });

    // Excluindo o arquivo temporário após o upload
    fs.unlinkSync(filePath);

    res.status(200).send(uploadResponse.data);

  } catch (error) {
    console.log(error)
    res.status(500).json({ error: 'Erro ao fazer upload do arquivo', 'err': error });
  }
});


app.listen(process.env.PORT || port);

module.exports = app;
