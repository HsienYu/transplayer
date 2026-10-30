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
let page_flag = 0;
//remove all focus function for linux platform
let task = {
  10: {
    action: async () => {
      await controller.goTo(
        14,
        "https://www.google.com/search?q=elephant%20news&tbm=isch&hl=en&hl=en&tbs=qdr:y&client=ubuntu&hs=OJ7&sa=X&ved=0CAQQpwVqFwoTCKjqn4-zluwCFQAAAAAdAAAAABAD&biw=1797&bih=1370"
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
        "https://www.google.com/search?biw=1440&bih=798&tbm=isch&sxsrf=ACYBGNT_rUSmalUS6R34zPF8dOP-8X2iGw%3A1572500280528&sa=1&ei=OHO6Xc_rH-S2mAWoobRQ&q=map+of+melaka+fort&oq=map+of+melaka+fort&gs_l=img.3...2682.4688..4911...0.0..0.75.359.7......0....1..gws-wiz-img.wi4Ueu-el5k&ved=0ahUKEwjP54SF5MXlAhVkG6YKHagQDQoQ4dUDCAc&uact=5#imgrc=_"
      );
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
        "https://www.google.com/search?biw=1440&bih=798&tbm=isch&sxsrf=ACYBGNQQsBvgZwqToOA7UAOcJN-8iSQVdw%3A1572495124539&sa=1&ei=FF-6XdexIJPpmAWzxIT4Ag&q=Telecom+tower&oq=Telecom+tower&gs_l=img.3..0i19l10.40579.40579..40997...0.0..0.47.47.1......0....2j1..gws-wiz-img.dr-TaZ-ge80&ved=0ahUKEwjXi7zq0MXlAhWTNKYKHTMiAS8Q4dUDCAc&uact=5"
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
        "https://www.google.com/search?q=starlink&tbm=isch&ved=2ahUKEwi7jsC72J7sAhVXAqYKHUfXBQEQ2-cCegQIABAA&oq=starlink&gs_lcp=CgNpbWcQAzICCAAyAggAMgIIADICCAAyAggAMgIIADICCAAyAggAMgIIADICCAA6BAgAEEM6BQgAELEDUL_2Bljd_wZg3oEHaABwAHgAgAE4iAH3ApIBATiYAQCgAQGqAQtnd3Mtd2l6LWltZ8ABAQ&sclient=img&ei=rbd7X_uDEteEmAXHrpcI&bih=798&biw=1440"
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
        "https://www.google.com/search?q=pawang&tbm=isch&ved=2ahUKEwiFv6WR2Z7sAhUNUJQKHXXuDDAQ2-cCegQIABAA&oq=pawang&gs_lcp=CgNpbWcQAzICCAAyAggAMgIIADICCAAyAggAMgIIADICCAAyAggAMgIIADICCABQ8ydY8ydghS5oAHAAeACAAS-IAS-SAQExmAEAoAEBqgELZ3dzLXdpei1pbWfAAQE&sclient=img&ei=Ybh7X8WKDY2g0QT13LOAAw&bih=798&biw=1440"
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
        "https://www.google.com/search?q=elephant+in+keddah&tbm=isch&nfpr=1&client=ubuntu&hs=PKo&hl=en&sa=X&ved=2ahUKEwiyoNWJ6p_sAhUHDpQKHS6pDD4QvgV6BAgBECg&biw=1068&bih=1137"
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
        "https://www.google.com/search?q=elephant+attack&tbm=isch&ved=2ahUKEwiI_YDj2Z7sAhXXyosBHbtbAykQ2-cCegQIABAA&oq=elephant+attac&gs_lcp=CgNpbWcQARgAMgIIADICCAAyAggAMgIIADICCAAyAggAMgIIADICCAAyAggAMgIIADoGCAAQChAYUPO2CFjpwAhgs8wIaAFwAHgAgAE2iAGUApIBATaYAQCgAQGqAQtnd3Mtd2l6LWltZ8ABAQ&sclient=img&ei=DLl7X4jHI9eVr7wPu7eNyAI&bih=798&biw=1440"
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
        "https://www.google.com/search?q=elephant+bone+&tbm=isch&ved=2ahUKEwjw_aLT2p7sAhV0xYsBHfFDDXwQ2-cCegQIABAA&oq=elephant+bone+&gs_lcp=CgNpbWcQAzIECAAQQzICCAAyAggAMgIIADICCAAyAggAMgIIADICCAAyAggAMgIIAFCvDFivDGCND2gAcAB4AIABMYgBMZIBATGYAQCgAQGqAQtnd3Mtd2l6LWltZ8ABAQ&sclient=img&ei=-Ll7X_ChAfSKr7wP8Ye14Ac&bih=798&biw=1440"
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
        "https://www.google.com/search?q=history+and+ethnography+museum&tbm=isch&ved=2ahUKEwjJqNbU2p7sAhVKXpQKHdBfCtwQ2-cCegQIABAA&oq=history+and+ethno&gs_lcp=CgNpbWcQARgAMgIIADIECAAQGDoFCAAQsQM6BAgAEEM6BggAEAUQHlCf_AVYwNkGYI7rBmgBcAB4AIABOYgBuAWSAQIxNZgBAKABAaoBC2d3cy13aXotaW1nwAEB&sclient=img&ei=-rl7X8nDOsq80QTQv6ngDQ&bih=798&biw=1440"
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
        "https://www.google.com/search?q=history+gunpowder&tbm=isch&ved=2ahUKEwjZpJ28257sAhVL0ZQKHfSyBSwQ2-cCegQIABAA&oq=history+gunpowder&gs_lcp=CgNpbWcQAzICCAAyBggAEAgQHjIGCAAQCBAeMgYIABAIEB5Q3wpY0xtg1R1oAHAAeACAAbcBiAGlBZIBBDEzLjGYAQCgAQGqAQtnd3Mtd2l6LWltZ8ABAQ&sclient=img&ei=1Lp7X9nqB8ui0wT05ZbgAg&bih=798&biw=1440"
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
        "https://www.google.com/search?q=gunpowder+explosion&tbm=isch&ved=2ahUKEwiU4syS3J7sAhWaAaYKHRH7DtAQ2-cCegQIABAA&oq=gunpowder+explosion&gs_lcp=CgNpbWcQAzIECAAQQzICCAAyBggAEAUQHjIGCAAQBRAeMgYIABAFEB4yBggAEAgQHjIGCAAQCBAeMgYIABAIEB4yBAgAEBgyBAgAEBg6BAgAEB5Q1QxY7xBglxRoAHAAeACAATCIAbYBkgEBNJgBAKABAaoBC2d3cy13aXotaW1nwAEB&sclient=img&ei=ibt7X9T5D5qDmAWR9ruADQ&bih=798&biw=1440"
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
        "https://www.google.com/search?q=+explosion&tbm=isch&ved=2ahUKEwj04qOU3J7sAhVMAKYKHXHEAhwQ2-cCegQIABAA&oq=+explosion&gs_lcp=CgNpbWcQAzIECAAQQzIECAAQQzICCAAyAggAMgQIABBDMgIIADICCAAyBAgAEEMyAggAMgIIAFC7xgRYu8YEYMvOBGgAcAB4AIABNYgBNZIBATGYAQCgAQGqAQtnd3Mtd2l6LWltZ8ABAQ&sclient=img&ei=jLt7X_TsL8yAmAXxiIvgAQ&bih=798&biw=1440"
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
          "https://www.google.com/search?q=world%20news&tbm=isch&hl=en&hl=en&tbs=qdr:d&client=ubuntu&hs=OJ7&sa=X&ved=0CAIQpwVqFwoTCODSq6-yluwCFQAAAAAdAAAAABAC&biw=1797&bih=1370"
        );
        await controller.setBrowserRect(13, {
          x: 0,
          y: 0,
          width: display_width,
          height: display_height,
        });
        controller.SCROLL_GAP = 1;
        controller.SCROLL_INTERVAL = 10;
        controller.scrollTo(13, 9000);
      } else {
        await controller.breakScroll(19);
        await controller.closeBrowser(19);
        await controller.goTo(
          13,
          "https://www.google.com/search?q=world%20news&tbm=isch&hl=en&hl=en&tbs=qdr:d&client=ubuntu&hs=OJ7&sa=X&ved=0CAIQpwVqFwoTCODSq6-yluwCFQAAAAAdAAAAABAC&biw=1797&bih=1370"
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
