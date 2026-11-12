// The canonical set of image-search queries the piece drives (defined in the
// timeline in web-process-new.js). The snapshot seed captures a clean results
// page for each one. tests/queries.test.js asserts this list stays exactly in
// sync with the URLs in web-process-new.js, so a timeline edit can never silently
// desync the seed.
module.exports = [
  "https://www.google.com/search?q=elephant%20news&tbm=isch&tbs=qdr:y",
  "https://www.google.com/search?q=map%20of%20melaka%20fort&tbm=isch",
  "https://www.google.com/search?q=Telecom%20tower&tbm=isch",
  "https://www.google.com/search?q=starlink&tbm=isch",
  "https://www.google.com/search?q=pawang&tbm=isch",
  "https://www.google.com/search?q=elephant%20in%20keddah&tbm=isch",
  "https://www.google.com/search?q=elephant%20attack&tbm=isch",
  "https://www.google.com/search?q=elephant%20bone%20&tbm=isch",
  "https://www.google.com/search?q=history%20and%20ethnography%20museum&tbm=isch",
  "https://www.google.com/search?q=history%20gunpowder&tbm=isch",
  "https://www.google.com/search?q=gunpowder%20explosion&tbm=isch",
  "https://www.google.com/search?q=%20explosion&tbm=isch",
  "https://www.google.com/search?q=world%20news&tbm=isch&tbs=qdr:d",
];
