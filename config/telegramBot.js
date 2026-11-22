const { Bot: TelegramBot } = require("node-telegram-bot-api");

const translations = {
  en: {
    welcome:
      "🎉 Welcome to Desu Bingo!\n\nWelcome Bonus: 10 Birr directly into your account\n\nChoose an option below:",
    about:
      "🎉🔥 Welcome to Desu Bingo (DESU BINGO)! 🎮\n\nWelcome Bonus: 10 Birr directly into your account!!\n\n  Enjoy an exciting online Bingo experience and try your luck for a chance to win cash prizes! \n💰 Who knows? Today might be your lucky day!\n 🌟 Visit our website, choose a game room and your Bingo card, confirm your card, and enjoy the game while following the game rules! \n🚀 DESU BINGO – Could today be your winning day?",
    website: "Open the Desu Bingo website:",
    websiteUnavailable: "The website link is not configured yet.",
    support: "For assistance, contact our support team:",
    supportButton: "Contact support",
    chooseLanguage: "Choose your language:",
    languageChanged: "Language set to English.",
    unknown: "Unknown Command❌, Please choose an option from the menu.",
    menu: [
      ["🎮 About the Game"],
      ["🌐 Open the Game"],
      ["📞 Help & Support"],
      ["🌍 Change Language"],
    ],
  },
  am: {
    welcome: "🎉 ወደ ዴሱ ቢንጎ እንኳን በደህና መጡ!\n\nከታች አንዱን ይምረጡ፦",
    about:
      "🎉🔥 እንኳን ወደ ደሱ ቢንጎ (DESU BINGO) በደህና መጡ! 🎮\n\n🎁 እንኳን ደህና መጡ ቦነስ፦ 10 ብር በቀጥታ ወደ አካውንትዎ። እየተዝናኑ የገንዘብ ሽልማት እና የማሸነፍ ዕድልዎን ይሞክሩ!\n 💰 ማን ያውቃል? ምናልባት ዛሬ የእርስዎ የድል ቀን ይሆናል!\n 🌟 ጨዋታውን ይክፈቱ፣ የጨዋታ ክፍልና ካርድ ይምረጡ፣ ካርዱን ያረጋግጡ እና የጨዋታውን ደንቦች በመከተል ይዝናኑ!\n 🚀 DESU BINGO – ዛሬ የማን የድል ቀን ይሆን?",
    website: "የደሱ ቢንጎ ጨዋታን ይክፈቱ፦",
    websiteUnavailable: "የድረ-ገጹ አድራሻ ገና አልተዋቀረም።",
    support: "እገዛ ከፈለጉ የድጋፍ ቡድናችንን ያግኙ፦",
    supportButton: "ድጋፍን ያግኙ",
    chooseLanguage: "ቋንቋዎን ይምረጡ፦",
    languageChanged: "ቋንቋው ወደ አማርኛ ተቀይሯል።",
    unknown: "የማይታወቅ ትዛዝ ነው❌ እባክዎ ከታች ካለው ዝርዝር  አንዱን ይምረጡ።",
    menu: [
      ["🎮 ስለ ጨዋታው"],
      ["🌐 ጨዋታውን ይክፈቱ"],
      ["📞 እገዛ እና ድጋፍ"],
      ["🌍 ቋንቋ ቀይር"],
    ],
  },
};

function getConfiguredUrl(value) {
  if (!value) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.info("Telegram bot is disabled: TELEGRAM_BOT_TOKEN is not set.");
    return null;
  }

  const bot = new TelegramBot(token);
  const languages = new Map();
  const websiteUrl = getConfiguredUrl(process.env.FRONTEND_URL);
  const supportUrl =
    getConfiguredUrl(process.env.SUPPORT_TELEGRAM_URL) ||
    "https://t.me/desubingo";

  const menuOptions = (language) => ({
    reply_markup: {
      keyboard: translations[language].menu,
      resize_keyboard: true,
    },
  });

  bot.command(["start", "help"], async (ctx) => {
    const language = languages.get(ctx.chatId) || "en";
    await ctx.reply(
      translations[language].welcome,
      menuOptions(language),
    );
  });

  bot.hears(["English", "አማርኛ"], async (ctx) => {
    const text = ctx.message?.text;
    const selectedLanguage = text === "አማርኛ" ? "am" : "en";
    if (ctx.chatId === undefined) return;
    languages.set(ctx.chatId, selectedLanguage);
    await ctx.reply(
      translations[selectedLanguage].languageChanged,
      menuOptions(selectedLanguage),
    );
  });

  const menuActions = {
    "🎮 About the Game": "about",
    "🎮 ስለ ጨዋታው": "about",
    "🌐 Open the Game": "website",
    "🌐 ጨዋታውን ይክፈቱ": "website",
    "📞 Help & Support": "support",
    "📞 እገዛ እና ድጋፍ": "support",
    "🌍 Change Language": "language",
    "🌍 ቋንቋ ቀይር": "language",
  };

  bot.hears(Object.keys(menuActions), async (ctx) => {
    const text = ctx.message?.text;
    if (!text || ctx.chatId === undefined) return;

    const language = languages.get(ctx.chatId) || "en";
    const messages = translations[language];

    switch (menuActions[text]) {
      case "about":
        await ctx.reply(messages.about, menuOptions(language));
        break;
      case "website":
        if (websiteUrl) {
          await ctx.reply(messages.website, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Desu Bingo", url: websiteUrl }],
              ],
            },
          });
        } else {
          await ctx.reply(messages.websiteUnavailable, menuOptions(language));
        }
        break;
      case "support":
        await ctx.reply(messages.support, {
          reply_markup: {
            inline_keyboard: [
              [{ text: messages.supportButton, url: supportUrl }],
            ],
          },
        });
        break;
      case "language":
        await ctx.reply(messages.chooseLanguage, {
          reply_markup: {
            keyboard: [["English", "አማርኛ"]],
            resize_keyboard: true,
            one_time_keyboard: true,
          },
        });
        break;
      default:
        await sendMessage(chatId, messages.unknown, menuOptions(language));
    }
  });

  bot.on("message", async (ctx) => {
    const text = ctx.message?.text;
    if (!text || text.startsWith("/")) return;

    const language =
      ctx.chatId === undefined ? "en" : languages.get(ctx.chatId) || "en";
    await ctx.reply(
      translations[language].unknown,
      menuOptions(language),
    );
  });

  bot.catch((error) => {
    console.error(
      "Telegram update failed:",
      error instanceof Error ? error.message : error,
    );
  });

  console.info("Telegram bot polling is enabled.");
  bot.startPolling().catch((error) => {
    console.error(
      "Telegram polling failed:",
      error instanceof Error ? error.message : error,
    );
  });

  return bot;
}

module.exports = { startTelegramBot };
