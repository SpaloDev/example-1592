const fs = require('fs')
const {google} = require('googleapis')
const mime = require('mime-types')
const path = require('path')
const axios = require('axios')
const admZip = require('adm-zip')

const conf = require('./config.json')

const gAuth = require('./google-auth')
const spalo = require('./spalo')

// check SPALO historyId
const historyId  = process.argv[2]

if(!historyId) return console.log("Error: historyId not found")

// SPALO Target API - history image download API
const spaloLoginPath = conf.spaloApiBasePath + '/user/login'
const spaloApiPath = conf.spaloApiBasePath + '/history/download/image/' + historyId

// Google Drive Settings
const googleDriveFolderId = conf.googleDriveFolderId

// Local image dir
const localDir = conf.localSaveDir

fs.access(localDir, (err) => {
  if(err) fs.mkdirSync(localDir)
})

// Load client secrets from a local file.
fs.readFile('credentials.json', (err, content) => {
  if (err) return console.log('Error loading client secret file:', err)
  // Authorize a client with credentials, then call the Google Drive API.
  //authorize(JSON.parse(content), listFiles);
  gAuth.authorize(JSON.parse(content), saveFiles)
})


async function saveFiles(auth) {

  try {

    const drive = google.drive({version: 'v3', auth})

    const token = await spalo.getToken(spaloLoginPath, conf.spaloAccount)
    const zipFileName = await spalo.download(spaloApiPath, token, localDir)

    // unzip and upload each images
    const zip = new admZip(localDir + '/' + zipFileName)

    for (let zipEntry of zip.getEntries()) {
      
      let fileName = path.basename(zipEntry.entryName)
      let mimeType = mime.lookup(zipEntry.entryName)
      fs.writeFileSync(localDir + '/' + fileName, zipEntry.getData(), 'binary')
      console.log("Saved: " + fileName)

      let params = {
          resource: {
              name: fileName,
              parents: [googleDriveFolderId]
          },
          media: {
              mimeType: mimeType,
              body: fs.createReadStream(localDir + '/' + fileName)
          },
          fields: 'id'
      };

      let res = drive.files.create(params)
      //console.log(res.data)

      fs.unlinkSync(localDir + '/' + zipFileName)
    
    }
  
  } catch (err) {
    console.log(err)
  }

  console.log('FIN')

}
