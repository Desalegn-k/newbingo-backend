const { Bot: TelegramBot } = require("node-telegram-bot-api");
const {
  createTelegramRegistrationToken,
} = require("../utils/telegramRegistration");
const { normalizeTelegramPhone } = require("../utils/phoneValidation");

const translations = {
  en: {
    welcome:
      "🎉 Welcome to Desu Bingo!\n\nWelcome Bonus: 10 Birr directly into your account\n\nChoose an option below:",
    about:
      "🎉🔥 Welcome to Desu Bingo (DESU BINGO)! 🎮\n\nWelcome Bonus: 10 Birr directly into your account!!\n\nEnjoy an exciting online Bingo experience and try your luck for a chance to win cash prizes!\n💰 Who knows? Today might be your lucky day!\n🌟 Visit our website, choose a game room and your Bingo card, confirm your card, and enjoy the game while following the game rules!\n🚀 DESU BINGO – Could today be your winning day?",
    website: "Open the Desu Bingo website 👇:",
    websiteUnavailable: "The website link is not configured yet.",
    support: "For assistance, contact our support team 👇:",
    supportButton: "Contact support",
    chooseLanguage: "Choose your language:",
    languageChanged: "Language set to English.",
    register: "Share your own phone number using the button below to register.",
    contactButton: "📱 Share my phone number",
    contactRequired:
      "Please use the button to share your own phone number. Other contacts cannot be used to register.",
    invalidPhone:
      "That phone number could not be validated. Please share a valid number.",
    registrationReady:
      "Your phone number is verified. Continue registration using this secure link. It expires in 10 minutes.",
    registrationButton: "Continue registration",
    registrationUnavailable:
      "Registration links are unavailable. Please try again later.",
    unknown: "Unknown command ❌ Please choose an option from the menu.",
    menu: [
      ["🎮 About the Game"],
      ["🌐 Open the Game"],
      ["📝 Register"],
      ["📞 Help & Support"],
      ["🌍 Change Language"],
    ],
  },
  am: {
    welcome: "🎉 ወደ ዴሱ ቢንጎ እንኳን በደህና መጡ!\n\nከታች አንዱን ይምረጡ፦",
    about:
      "🎉🔥 እንኳን ወደ ደሱ ቢንጎ (DESU BINGO) በደህና መጡ! 🎮\n\n🎁 እንኳን ደህና መጡ ቦነስ፦ 10 ብር በቀጥታ ወደ አካውንትዎ። እየተዝናኑ የገንዘብ ሽልማት እና የማሸነፍ ዕድልዎን ይሞክሩ!\n💰 ማን ያውቃል? ምናልባት ዛሬ የእርስዎ የድል ቀን ይሆናል!\n🌟 ጨዋታውን ይክፈቱ፣ የጨዋታ ክፍልና ካርድ ይምረጡ፣ ካርዱን ያረጋግጡ እና የጨዋታውን ደንቦች በመከተል ይዝናኑ!\n🚀 DESU BINGO – ዛሬ የማን የድል ቀን ይሆን?",
    website: "የደሱ ቢንጎ ጨዋታን ይክፈቱ 👇፦",
    websiteUnavailable: "የድረ-ገጹ አድራሻ ገና አልተዋቀረም።",
    support: "እገዛ ከፈለጉ የድጋፍ ቡድናችንን ያግኙ 👇፦",
    supportButton: "ድጋፍን ያግኙ",
    chooseLanguage: "ቋንቋዎን ይምረጡ፦",
    languageChanged: "ቋንቋው ወደ አማርኛ ተቀይሯል።",
    register: "ለመመዝገብ የራስዎን ስልክ ቁጥር ከታች ባለው ቁልፍ ያጋሩ።",
    contactButton: "📱 የራሴን ስልክ ቁጥር አጋራ",
    contactRequired:
      "እባክዎ የራስዎን ስልክ ቁጥር በታች ባለው ቁልፍ ያጋሩ። የሌላ ሰው ቁጥር ለመመዝገብ አይቻልም።",
    invalidPhone: "የተጋሩት ስልክ ቁጥር ትክክለኛ አይደለም። እባክዎ ትክክለኛ ቁጥር ያጋሩ።",
    registrationReady:
      "የስልክ ቁጥርዎ ተረጋግጧል። ለመመዝገብ ከታች ያለውን አስተማማኝ ሊንክ ይጠቀሙ። ሊንኩ ከ10 ደቂቃ በኋላ ያበቃል።",
    registrationButton: "ምዝገባውን ይቀጥሉ",
    registrationUnavailable:
      "የምዝገባ ሊንክ አልተዘጋጀም። እባክዎ ቆይተው ይሞክሩ።",
    unknown: "ያልታወቀ ትዕዛዝ ❌ እባክዎ ከዝርዝሩ አንዱን ይምረጡ።",
    menu: [
      ["🎮 ስለ ጨዋታው"],
      ["🌐 ጨዋታውን ይክፈቱ"],
      ["📝 ይመዝገቡ"],
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

function getSecureFrontendUrl(value) {
  const configuredUrl = getConfiguredUrl(value);
  if (!configuredUrl) return null;

  const url = new URL(configuredUrl);
  const isLocalDevelopment =
    url.hostname === "localhost" || url.hostname === "127.0.0.1";
  return url.protocol === "https:" || isLocalDevelopment ? url : null;
}

function startTelegramBot() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) {
    console.info("Telegram bot is disabled: TELEGRAM_BOT_TOKEN is not set.");
    return null;
  }

  const bot = new TelegramBot(token);
  const languages = new Map();
  const pendingRegistrations = new Map();
  const websiteUrl = getConfiguredUrl(process.env.FRONTEND_URL);
  const registrationBaseUrl = getSecureFrontendUrl(process.env.FRONTEND_URL);
  const supportUrl =
    getConfiguredUrl(process.env.SUPPORT_TELEGRAM_URL) ||
    "https://t.me/DesuBingoSupporter";

  const menuOptions = (language) => ({
    reply_markup: {
      keyboard: translations[language].menu,
      resize_keyboard: true,
    },
  });
  const send = (ctx, text, options) => ctx.reply(text, options);

  const menuActions = {
    "🎮 About the Game": "about",
    "🎮 ስለ ጨዋታው": "about",
    "🌐 Open the Game": "website",
    "🌐 ጨዋታውን ይክፈቱ": "website",
    "📝 Register": "register",
    "📝 ይመዝገቡ": "register",
    "📞 Help & Support": "support",
    "📞 እገዛ እና ድጋፍ": "support",
    "🌍 Change Language": "language",
    "🌍 ቋንቋ ቀይር": "language",
  };

  bot.on("message", async (ctx) => {
    const message = ctx.message;
    const telegramUserId = ctx.from?.id;
    if (!message || ctx.chatId === undefined || telegramUserId === undefined) {
      return;
    }

    const userKey = String(telegramUserId);
    const language = languages.get(userKey) || "en";
    const messages = translations[language];

    try {
      if (message.contact) {
        const contact = message.contact;
        const isPrivateChat = ctx.chat?.type === "private";
        const isOwnContact =
          contact.user_id !== undefined &&
          String(contact.user_id) === userKey;
        const requestExpiresAt = pendingRegistrations.get(userKey);
        pendingRegistrations.delete(userKey);
        const requestedRegistration =
          requestExpiresAt !== undefined && requestExpiresAt > Date.now();

        if (!isPrivateChat || !requestedRegistration || !isOwnContact) {
          await send(ctx, messages.contactRequired, menuOptions(language));
          return;
        }

        const phone = normalizeTelegramPhone(contact.phone_number);
        if (!phone) {
          await send(ctx, messages.invalidPhone, menuOptions(language));
          return;
        }

        if (!registrationBaseUrl) {
          await send(
            ctx,
            messages.registrationUnavailable,
            menuOptions(language),
          );
          return;
        }

        const registrationToken = await createTelegramRegistrationToken(
          telegramUserId,
          phone,
        );
        const registrationUrl = new URL("/register", registrationBaseUrl);
        registrationUrl.searchParams.set("telegram_token", registrationToken);

        await send(ctx, messages.registrationReady, {
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: messages.registrationButton,
                  url: registrationUrl.toString(),
                },
              ],
            ],
          },
        });
        return;
      }

      const text = message.text;
      if (!text) return;

      if (/^\/(?:start|help)(?:@\w+)?(?:\s|$)/i.test(text)) {
        await send(ctx, messages.welcome, menuOptions(language));
        return;
      }

      if (text === "English" || text === "አማርኛ") {
        const selectedLanguage = text === "አማርኛ" ? "am" : "en";
        languages.set(userKey, selectedLanguage);
        await send(
          ctx,
          translations[selectedLanguage].languageChanged,
          menuOptions(selectedLanguage),
        );
        return;
      }

      const action = menuActions[text];
      if (!action) {
        if (!text.startsWith("/")) {
          await send(ctx, messages.unknown, menuOptions(language));
        }
        return;
      }

      switch (action) {
        case "about":
          await send(ctx, messages.about, menuOptions(language));
          break;
        case "website":
          if (websiteUrl) {
            await send(ctx, messages.website, {
              reply_markup: {
                inline_keyboard: [
                  [{ text: "Open Desu Bingo Game", url: websiteUrl }],
                ],
              },
            });
          } else {
            await send(
              ctx,
              messages.websiteUnavailable,
              menuOptions(language),
            );
          }
          break;
        case "register":
          if (!registrationBaseUrl) {
            await send(
              ctx,
              messages.registrationUnavailable,
              menuOptions(language),
            );
            break;
          }
          if (ctx.chat?.type !== "private") {
            await send(
              ctx,
              "Please open a private chat with this bot to register.",
              menuOptions(language),
            );
            break;
          }
          pendingRegistrations.set(userKey, Date.now() + 5 * 60 * 1000);
          await send(ctx, messages.register, {
            reply_markup: {
              keyboard: [
                [{ text: messages.contactButton, request_contact: true }],
              ],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });
          break;
        case "support":
          await send(ctx, messages.support, {
            reply_markup: {
              inline_keyboard: [
                [{ text: messages.supportButton, url: supportUrl }],
              ],
            },
          });
          break;
        case "language":
          await send(ctx, messages.chooseLanguage, {
            reply_markup: {
              keyboard: [["English", "አማርኛ"]],
              resize_keyboard: true,
              one_time_keyboard: true,
            },
          });
          break;
        default:
          await send(ctx, messages.unknown, menuOptions(language));
      }
    } catch (error) {
      console.error(
        "Telegram message handling failed:",
        error instanceof Error ? error.message : error,
      );
      try {
        await send(
          ctx,
          messages.registrationUnavailable,
          menuOptions(language),
        );
      } catch (replyError) {
        console.error(
          "Telegram error reply failed:",
          replyError instanceof Error ? replyError.message : replyError,
        );
      }
    }
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
