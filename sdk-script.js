const AWS = require('aws-sdk');
const fs = require('fs/promises');
const path = require('path');
const s3 = new AWS.S3({region: 'us-east-1'});
const ssm = new AWS.SSM({region: 'us-east-1'});

const extMime = {
  '.ico': 'image/x-icon',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
};

async function createDragonsBucket() {
  const params = {
    Bucket: process.env.MYBUCKET,
  };
  const createResult = await s3.createBucket(params).promise();
  console.log(createResult);
}

async function listAllBuckets() {
  const listResult = await s3.listBuckets({}).promise();
  listResult.Buckets.forEach((bucket) => console.log(bucket.Name));
}

async function* walk(dir) {
  for await (const d of await fs.opendir(dir)) {
    const entry = path.join(dir, d.name);
    if (d.isDirectory()) yield* await walk(entry);
    else if (d.isFile()) yield entry;
  }
}

async function uploadDragonsApp() {
  const webapp = path.join(process.env.HOME, 'webapp1');
  for await (const fullpath of walk(webapp)) {
    const relpath = path.relative(webapp, fullpath);
    const mimetype = extMime[path.extname(relpath)];
    const data = await fs.readFile(fullpath);
    const base64data = Buffer.from(data);
    const params = {
      ACL: 'public-read',
      Body: base64data,
      Bucket: process.env.MYBUCKET,
      Key: 'dragonsapp/' + relpath,
      ContentType: mimetype,
    };
    await s3.putObject(params).promise();
    console.log('uploaded ', relpath);
  }
}

async function uploadDragonsData() {
  const data = await fs.readFile('dragon_stats_one.txt');
  const base64data = Buffer.from(data);
  const params = {
    Body: base64data,
    Bucket: process.env.MYBUCKET,
    Key: 'dragon_stats_one.txt',
  };
  await s3.putObject(params).promise();
  console.log('uploaded dragon_stats_one');
}

async function putDragonParameters() {
  const p1 = await ssm.putParameter({
    Name: 'dragon_data_bucket',
    Value: process.env.MYBUCKET,
    Overwrite: true,
    Type: 'String',
  }).promise();
  console.log(p1);
  const p2 = await ssm.putParameter({
    Name: 'dragon_data_file_name',
    Value: 'dragon_stats_one.txt',
    Overwrite: true,
    Type: 'String',
  }).promise();
  console.log(p2);
}

function printMenu() {
  console.log('1. Create the dragons bucket');
  console.log('2. List all buckets');
  console.log('3. Upload dragons app');
  console.log('4. Upload dragons data');
  console.log('5. Set parameter store parameters');
  console.log('6. Exit');
}

function menuLoop() {
  const readline = require('readline');
  const rl = readline.createInterface(process.stdin, process.stdout);

  rl.setPrompt('Enter your choice [1-5]:  ');
  printMenu();
  rl.prompt();
  rl.on('line', async (line) => {
    let quitting = false;
    switch (line) {
      case '1':
        await createDragonsBucket();
        break;
      case '2':
        await listAllBuckets();
        break;
      case '3':
        await uploadDragonsApp();
        console.log(`URL: https://${process.env.MYBUCKET}.s3.amazonaws.com/dragonsapp/index.html`);
        break;
      case '4':
        await uploadDragonsData();
        break;
      case '5':
        await putDragonParameters();
        break;
      case '6':
        quitting = true;
        rl.close();
        break;
    }

    if (!quitting) {
      printMenu();
      rl.prompt();
    }
  });
}

if (!process.env.MYBUCKET) {
  console.log('Please set MYBUCKET environment variable');
  process.exit(1);
}

menuLoop();