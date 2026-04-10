import fs from 'fs';

async function test() {
  const form = new FormData();
  form.append('file', new Blob([fs.readFileSync('package.json')]), 'package.json');
  const res = await fetch('https://cdn-slave.spin.rip/api/upload', {
    method: 'POST',
    body: form,
    headers: {
      'Upload-Source': 'API'
    }
  });
  const data = await res.text();
  console.log(data);
}
test();
