const fs = require('fs');
const fetch = require('node-fetch');
const FormData = require('form-data');

async function test() {
  const form = new FormData();
  form.append('file', fs.createReadStream('package.json'));
  const res = await fetch('https://cdn-slave.spin.rip/api/upload', {
    method: 'POST',
    body: form,
    headers: {
      'Upload-Source': 'API'
    }
  });
  const data = await res.json();
  console.log(data);
}
test();
