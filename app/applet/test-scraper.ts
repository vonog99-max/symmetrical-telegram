import * as cheerio from 'cheerio';
fetch('https://www.bing.com/images/search?q=site:pinterest.com+aesthetic+pfp', {
    headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64 AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36)'}
}).then(r=>r.text()).then(t => {
    const $ = cheerio.load(t);
    const res: string[] = [];
    $('.iusc').each((i, el) => {
        const mstr = $(el).attr('m');
        if (mstr) {
            try {
                const m = JSON.parse(mstr);
                if (m.murl) res.push(m.murl);
            } catch(e) {}
        }
    });
    console.log("Found:", res.slice(0, 5));
});
