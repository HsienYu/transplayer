const { By } = require("selenium-webdriver");

const Controller = require("./controller");

const delay = (interval) => {
  return new Promise((resolve) => {
    setTimeout(resolve, interval);
  });
};
require("events").EventEmitter.defaultMaxListeners = 100;
//require("events").EventEmitter.prototype._maxListeners = 100;

let controller = new Controller();

let display_width = 2160;
let display_height = 1920;
// Window 13 is the full-screen background. A normal Chrome window's outer size
// INCLUDES the GTK client-side-decoration invisible shadow (measured
// _GTK_FRAME_EXTENTS = 22,22,19,25 on this GNOME 50 / Chrome-for-Testing), so a
// plain {0,0,2160,1920} rect leaves the visible content inset — a purple desktop
// margin around it. Oversize + offset by the shadow so the VISIBLE content fills
// the whole 2160x1920 desktop edge-to-edge. Left/right shadow = 22+22 = 44,
// top/bottom shadow = 19+25 = 44.
let bg_rect = {
  x: -22,
  y: -19,
  width: display_width + 44,
  height: display_height + 44,
};
let page_flag = 0;
//remove all focus function for linux platform
let task = {
  10: {
    action: async () => {
      await controller.goTo(
        14,
        "https://www.google.com/search?q=elephant%20news&tbm=isch&tbs=qdr:y"
      );
      await controller.setBrowserRect(14, {
        x: 500,
        y: 180,
        width: 1620,
        height: 1620,
      });
      controller.scrollTo(14, 9000);
    },
  },
  65: {
    action: async () => {
      await controller.breakScroll(13);
      await controller.goTo(
        13,
        "https://www.google.com/search?q=map%20of%20melaka%20fort&tbm=isch"
      );
      // Window 13 is the persistent full-screen background: size it to the whole
      // desktop the moment it first appears, so it fills from here to the end
      // (14-19 are created later and stack above it). Only sized at creation,
      // not on later goTo(13) navigations, so it is never re-raised over an
      // active sub-window. bg_rect compensates for the GTK shadow so the visible
      // content reaches every edge (no desktop margin).
      await controller.setBrowserRect(13, bg_rect);
      controller.scrollTo(13, 9000);
    },
  },
  85: {
    action: async () => {
      await controller.breakScroll(14);
      await controller.closeBrowser(14);
    },
  },
  120: {
    action: async () => {
      await controller.goTo(
        15,
        "https://www.google.com/search?q=Telecom%20tower&tbm=isch"
      );
      await controller.setBrowserRect(15, {
        x: 500,
        y: 100,
        width: 1620,
        height: 1620,
      });
      controller.scrollTo(15, 9000);
    },
  },
  140: {
    action: async () => {
      await controller.breakScroll(13);
      await controller.goTo(
        13,
        "https://www.google.com/search?q=starlink&tbm=isch"
      );

      controller.scrollTo(13, 9000);
    },
  },
  190: {
    action: async () => {
      await controller.breakScroll(15);
      await controller.closeBrowser(15);
    },
  },
  230: {
    action: async () => {
      await controller.goTo(
        16,
        "https://www.google.com/search?q=pawang&tbm=isch"
      );
      await controller.setBrowserRect(16, {
        x: 400,
        y: 50,
        width: 1670,
        height: 1750,
      });
      controller.scrollTo(16, 9000);
    },
  },
  280: {
    action: async () => {
      await controller.breakScroll(13);
      await controller.goTo(
        13,
        "https://www.google.com/search?q=elephant%20in%20keddah&tbm=isch"
      );
      controller.scrollTo(13, 9000);
    },
  },
  290: {
    action: async () => {
      await controller.breakScroll(16);
      await controller.closeBrowser(16);
    },
  },
  320: {
    action: async () => {
      await controller.goTo(
        17,
        "https://www.google.com/search?q=elephant%20attack&tbm=isch"
      );
      await controller.setBrowserRect(17, {
        x: 30,
        y: 50,
        width: 1930,
        height: 1800,
      });
      controller.scrollTo(17, 9000);
    },
  },
  350: {
    action: async () => {
      await controller.breakScroll(13);
      await controller.goTo(
        13,
        "https://www.google.com/search?q=elephant%20bone%20&tbm=isch"
      );
      controller.scrollTo(13, 9000);
    },
  },
  410: {
    action: async () => {
      await controller.breakScroll(17);
      await controller.closeBrowser(17);
    },
  },
  440: {
    action: async () => {
      await controller.goTo(
        18,
        "https://www.google.com/search?q=history%20and%20ethnography%20museum&tbm=isch"
      );
      await controller.setBrowserRect(18, {
        x: 30,
        y: 50,
        width: 1830,
        height: 1800,
      });
      controller.scrollTo(18, 9000);
    },
  },
  450: {
    action: async () => {
      await controller.breakScroll(13);
      await controller.goTo(
        13,
        "https://www.google.com/search?q=history%20gunpowder&tbm=isch"
      );
      controller.scrollTo(13, 12000);
    },
  },
  500: {
    action: async () => {
      await controller.breakScroll(18);
      await controller.closeBrowser(18);
    },
  },
  580: {
    action: async () => {
      await controller.goTo(
        19,
        "https://www.google.com/search?q=gunpowder%20explosion&tbm=isch"
      );
      await controller.setBrowserRect(19, {
        x: 30,
        y: 300,
        width: 2100,
        height: 1600,
      });
      controller.scrollTo(19, 9000);
    },
  },
  610: {
    action: async () => {
      await controller.breakScroll(13);
      await controller.goTo(
        13,
        "https://www.google.com/search?q=%20explosion&tbm=isch"
      );
      controller.scrollTo(13, 12000);
    },
  },
  640: {
    action: async () => {
      await controller.breakScroll(19);
      await controller.closeBrowser(19);
    },
  },
  775: {
    action: async () => {
      if (page_flag == 0) {
        page_flag = 1;
        await controller.goTo(
          13,
          "https://www.google.com/search?q=world%20news&tbm=isch&tbs=qdr:d"
        );
        await controller.setBrowserRect(13, bg_rect);
        controller.SCROLL_GAP = 1;
        controller.SCROLL_INTERVAL = 10;
        controller.scrollTo(13, 9000);
      } else {
        await controller.breakScroll(19);
        await controller.closeBrowser(19);
        await controller.goTo(
          13,
          "https://www.google.com/search?q=world%20news&tbm=isch&tbs=qdr:d"
        );
        controller.scrollTo(13, 9000);
      }
    },
  },
};

async function callTask(t) {
  if (!task[t]) {
    return;
  }
  await task[t].action();
}
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  await controller.closeAllBrowser();
  process.exit(0);
}
process.on("SIGTERM", stop);
process.on("SIGINT", stop);
process.on("disconnect", stop);

process.on("message", function (args) {
  if (args.stop) { stop().catch(error => { console.error(error); process.exit(1); }); return; }
  if (stopping) return;
  let currentTime = args["currentTime"];
  callTask(currentTime).catch(error => console.error("Timeline action failed", currentTime, error));
});
if (process.send) process.send({ ready: true });
