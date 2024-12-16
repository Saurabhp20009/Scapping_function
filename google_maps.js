async function searchGoogleMaps() {
  try {
    const start = Date.now();
    const browser = await chromium.launch({
      headless: false
    });
    const context = await browser.newContext();
    const page = await context.newPage();
    const query = "book store";

    try {
      await page.goto(`https://www.google.com/maps/search/${query.split(" ").join("+")}`);
    } catch (error) {
      console.log("error going to page", error);
    }

    await autoScroll(page);

    const html = await page.content();
    const $ = cheerio.load(html);
    const aTags = $("a");
    const parents = [];
    aTags.each((i, el) => {
      const href = $(el).attr("href");
      if (href && href.includes("/maps/place/")) {
        parents.push($(el).parent());
      }
    });

    const connection = await getDatabaseConnection();
    const businesses = extractBusinessDetails(parents, connection);
    const end = Date.now();
    console.log(`Time in seconds: ${Math.floor((end - start) / 1000)}`);
    console.log(businesses);

    fs.writeFile('google_leads.json', JSON.stringify(businesses, null, 4), 'utf8', (err) => {
      if (err) {
        console.error('Failed to save data:', err);
      } else {
        console.log('Data saved to google_leads.json');
      }
    });

    //await browser.close();
    return businesses;
  } catch (error) {
    console.log("error at googleMaps", error.message);
  }
}

async function autoScroll(page) {
  await page.evaluate(async () => {
    const wrapper = document.querySelector('div[role="feed"]');
    await new Promise((resolve, reject) => {
      var totalHeight = 0;
      var distance = 1000;
      var scrollDelay = 3000;

      var timer = setInterval(async () => {
        var scrollHeightBefore = wrapper.scrollHeight;
        wrapper.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeightBefore) {
          totalHeight = 0;
          await new Promise((resolve) => setTimeout(resolve, scrollDelay));

          var scrollHeightAfter = wrapper.scrollHeight;
          if (scrollHeightAfter > scrollHeightBefore) {
            return;
          } else {
            clearInterval(timer);
            resolve();
          }
        }
      }, 200);
    });
  });
}


async function extractBusinessDetails(parents, connection) {
  const promises = parents.map(async parent => {
      const url = parent.find("a").attr("href");
      const website = parent.find('a[data-value="Website"]').attr("href");
      const storeName = parent.find("div.fontHeadlineSmall").text();
      const ratingText = parent.find("span.fontBodyMedium > span").attr("aria-label");

      const bodyDiv = parent.find("div.fontBodyMedium").first();
      const children = bodyDiv.children();
      const lastChild = children.last();
      const firstOfLast = lastChild.children().first();
      const lastOfLast = lastChild.children().last();

      const displayName = storeName; // Using storeName as displayName
      const description = firstOfLast?.text()?.split("·")?.[1]?.trim();

      const query = `
          INSERT INTO profiles(Name, Phone, Url, Website)
          VALUES (?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE Phone = VALUES(Phone);;`;

      const data = {
          placeId: `ChI${url?.split("?")?.[0]?.split("ChI")?.[1]}`,
          address: firstOfLast?.text()?.split("·")?.[1]?.trim(),
          category: firstOfLast?.text()?.split("·")?.[0]?.trim(),
          phone: lastOfLast?.text()?.split("·")?.[1]?.trim(),
          googleUrl: url,
          bizWebsite: website,
          storeName,
          ratingText,
          stars: parseFloat(ratingText?.split(" stars ")[0]),
          numberOfReviews: parseInt(ratingText?.split(" stars ")[1]?.replace("Reviews", "").trim())
      };

      // Execute the database query
      try {
          await connection.execute(query, [displayName, data.phone ? data.phone : null, data.googleUrl ? data.googleUrl : null, data.bizWebsite ? data.bizWebsite : null]);
      } catch (error) {
          console.error('Database query failed:', error);
          // Handle the error appropriately in your application context
      }

      return data;
  });

  // Wait for all promises to resolve
  return Promise.all(promises);
}
