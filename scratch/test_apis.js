async function testAPIs() {
  const KEY = "2600358e2ef4b12a80188bfd469634c0e455b12bf4bc244ee4b701b98ec4826c";
  const apis = ["PublicCctvInfo", "CctvEstshst", "SdePublicCctv", "TbOpendataFixedcctvDD"];
  
  for (const api of apis) {
    const url = `http://openapi.seoul.go.kr:8088/${KEY}/json/${api}/1/1/`;
    try {
      const resp = await fetch(url);
      const data = await resp.json();
      console.log(`API ${api}:`, data);
    } catch (e) {
      console.log(`API ${api} failed:`, e.message);
    }
  }
}
testAPIs();
