const go = async () => {
    const res = await fetch('https://api.github.com/repos/cybershadowvps/FreeVPS/git/trees/main?recursive=1');
    const json = await res.json();
    console.log(json);
};
go();
