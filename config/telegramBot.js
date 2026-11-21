const TelegramBot = require("node-telegram-bot-api");

const translations = {
  en: {
    welcome: "🎉 Welcome to Desu Bingo!\n\nChoose an option below:",
    about:
      "Desu Bingo is an online Bingo game. Open the website, choose a room and card, then confirm your card to play.",
    website: "Open the Desu Bingo website:",
    websiteUnavailable: "The website link is not configured yet.",
    support: "For assistance, contact our support team:",
    supportButton: "Contact support",
    chooseLanguage: "Choose your language:",
    languageChanged: "Language set to English.",
    unknown: "Please choose an option from the menu.",
    menu: [
      ["🎮 About the Game"],
      ["🌐 Open Website"],
      ["📞 Help & Support"],
      ["🌍 Change Language"],
    ],
  },
  am: {
    welcome: "🎉 ወደ ዴሱ ቢንጎ እንኳን በደህና መጡ!\n\nከታች አንዱን ይምረጡ፦",
    about:
      "ዴሱ ቢንጎ የመስመር ላይ የቢንጎ ጨዋታ ነው። ድረ-ገጹን ይክፈቱ፣ ክፍልና ካርድ ይምረጡ፣ ከዚያም ካርዱን ያረጋግጡ።",
    website: "የዴሱ ቢንጎ ድረ-ገጽን ይክፈቱ፦",
    websiteUnavailable: "የድረ-ገጹ አድራሻ ገና አልተዋቀረም።",
    support: "እገዛ ከፈለጉ የድጋፍ ቡድናችንን ያግኙ፦",
    supportButton: "ድጋፍን ያግኙ",
    chooseLanguage: "ቋንቋዎን ይምረጡ፦",
    languageChanged: "ቋንቋው ወደ አማርኛ ተቀይሯል።",
    unknown: "እባክዎ ከምናሌው አንዱን ይምረጡ።",
    menu: [
      ["🎮 ስለ ጨዋታው"],
      ["🌐 ድረ-ገጹን ክፈት"],
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

  const bot = new TelegramBot(token, { polling: true });
  const languages = new Map();
  const websiteUrl = getConfiguredUrl(process.env.FRONTEND_URL);
  const supportUrl =
    getConfiguredUrl(process.env.SUPPORT_TELEGRAM_URL) ||
    "https://t.me/desubingo";

  const sendMessage = async (chatId, text, options) => {
    try {
      await bot.sendMessage(chatId, text, options);
    } catch (error) {
      console.error("Telegram message failed:", error.message);
    }
  };

  const menuOptions = (language) => ({
    reply_markup: {
      keyboard: translations[language].menu,
      resize_keyboard: true,
    },
  });

  bot.onText(/^\/(?:start|help)(?:@\w+)?(?:\s|$)/, async (msg) => {
    const language = languages.get(msg.chat.id) || "en";
    await sendMessage(
      msg.chat.id,
      translations[language].welcome,
      menuOptions(language),
    );
  });

  bot.on("message", async (msg) => {
    const text = msg.text?.trim();
    if (!text || text.startsWith("/")) return;

    const chatId = msg.chat.id;
    const language = languages.get(chatId) || "en";
    const messages = translations[language];

    if (text === "English" || text === "አማርኛ") {
      const selectedLanguage = text === "አማርኛ" ? "am" : "en";
      languages.set(chatId, selectedLanguage);
      await sendMessage(
        chatId,
        translations[selectedLanguage].languageChanged,
        menuOptions(selectedLanguage),
      );
      return;
    }

    const menuActions = {
      "🎮 About the Game": "about",
      "🎮 ስለ ጨዋታው": "about",
      "🌐 Open Website": "website",
      "🌐 ድረ-ገጹን ክፈት": "website",
      "📞 Help & Support": "support",
      "📞 እገዛ እና ድጋፍ": "support",
      "🌍 Change Language": "language",
      "🌍 ቋንቋ ቀይር": "language",
    };

    switch (menuActions[text]) {
      case "about":
        await sendMessage(chatId, messages.about, menuOptions(language));
        break;
      case "website":
        if (websiteUrl) {
          await sendMessage(chatId, messages.website, {
            reply_markup: {
              inline_keyboard: [
                [{ text: "Desu Bingo", url: websiteUrl }],
              ],
            },
          });
        } else {
          await sendMessage(
            chatId,
            messages.websiteUnavailable,
            menuOptions(language),
          );
        }
        break;
      case "support":
        await sendMessage(chatId, messages.support, {
          reply_markup: {
            inline_keyboard: [
              [{ text: messages.supportButton, url: supportUrl }],
            ],
          },
        });
        break;
      case "language":
        await sendMessage(chatId, messages.chooseLanguage, {
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

  bot.on("polling_error", (error) => {
    console.error("Telegram polling error:", error.message);
  });

  console.info("Telegram bot polling is enabled.");
  return bot;
}

module.exports = { startTelegramBot };
