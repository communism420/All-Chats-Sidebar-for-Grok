(() => {
  "use strict";

  const LANGUAGE_ATTRIBUTE = "data-grok-show-all-chats-language";
  const LANGUAGE_CHANGE_EVENT = "grok-show-all-chats-language-change";
  const STORAGE_KEY = "language";
  const SUPPORTED_LANGUAGES = Object.freeze(["en", "es", "de", "pt-BR", "ru", "uk", "fr"]);
  const LANGUAGE_NAMES = Object.freeze({
    en: "English",
    es: "Español",
    de: "Deutsch",
    "pt-BR": "Português (Brasil)",
    ru: "Русский",
    uk: "Українська",
    fr: "Français"
  });

  const translations = {
    en: {
      extensionName: "All Chats Sidebar for Grok",
      extensionDescription: "Open-source, unofficial extension that shows the complete Grok chat history directly in the sidebar.",
      openSettings: "Open extension settings",
      languageLabel: "Interface language",
      automaticLanguage: "Automatic (browser)",
      privacyNotice: "Unofficial extension. Grok chat titles and metadata are processed only in your browser and are never sent to the developer.",
      sourceCode: "Open-source code (MIT)",
      resizeChatListAria: "Resize chat list",
      saved: "Saved",
      saveFailed: "Could not save the setting",
      allChatsAria: "All Grok chats",
      untitledChat: "Untitled",
      chatMenuAria: "Chat menu: {title}",
      openNewTab: "Open in new tab",
      rename: "Rename",
      pin: "Pin",
      unpin: "Unpin",
      delete: "Delete",
      renamePrompt: "New chat name",
      deleteConfirm: "Delete chat “{title}”?",
      unknownError: "unknown error",
      renameError: "Could not rename the chat: {message}",
      pinError: "Could not pin the chat: {message}",
      unpinError: "Could not unpin the chat: {message}",
      deleteError: "Could not delete the chat: {message}",
      pinned: "Pinned",
      history: "History",
      partialHistoryError: "Part of the history could not be loaded",
      historyError: "History could not be loaded",
      loadingHistory: "Loading history...",
      waitingHistory: "Waiting for history...",
      signedInRequired: "Sign in to Grok to view your chats.",
      noChats: "No chats found.",
      historyTooLarge: "The history is too large to load in one pass"
    },
    es: {
      extensionName: "Barra lateral de chats para Grok",
      extensionDescription: "Extensión no oficial y de código abierto que muestra todo el historial de chats de Grok en la barra lateral.",
      openSettings: "Abrir los ajustes de la extensión",
      languageLabel: "Idioma de la interfaz",
      automaticLanguage: "Automático (navegador)",
      privacyNotice: "Extensión no oficial. Los títulos y metadatos de los chats de Grok se procesan únicamente en tu navegador y nunca se envían al desarrollador.",
      sourceCode: "Código abierto (MIT)",
      resizeChatListAria: "Cambiar el ancho de la lista de chats",
      saved: "Guardado",
      saveFailed: "No se pudo guardar la configuración",
      allChatsAria: "Todos los chats de Grok",
      untitledChat: "Sin título",
      chatMenuAria: "Menú del chat: {title}",
      openNewTab: "Abrir en una pestaña nueva",
      rename: "Cambiar nombre",
      pin: "Fijar",
      unpin: "Desfijar",
      delete: "Eliminar",
      renamePrompt: "Nuevo nombre del chat",
      deleteConfirm: "¿Eliminar el chat «{title}»?",
      unknownError: "error desconocido",
      renameError: "No se pudo cambiar el nombre del chat: {message}",
      pinError: "No se pudo fijar el chat: {message}",
      unpinError: "No se pudo desfijar el chat: {message}",
      deleteError: "No se pudo eliminar el chat: {message}",
      pinned: "Fijados",
      history: "Historial",
      partialHistoryError: "No se pudo cargar parte del historial",
      historyError: "No se pudo cargar el historial",
      loadingHistory: "Cargando historial...",
      waitingHistory: "Esperando el historial...",
      signedInRequired: "Inicia sesión en Grok para ver tus chats.",
      noChats: "No se encontraron chats.",
      historyTooLarge: "El historial es demasiado grande para cargarlo de una sola vez"
    },
    de: {
      extensionName: "Chat-Seitenleiste für Grok",
      extensionDescription: "Inoffizielle Open-Source-Erweiterung, die den vollständigen Grok-Chatverlauf direkt in der Seitenleiste anzeigt.",
      openSettings: "Erweiterungseinstellungen öffnen",
      languageLabel: "Oberflächensprache",
      automaticLanguage: "Automatisch (Browser)",
      privacyNotice: "Inoffizielle Erweiterung. Titel und Metadaten der Grok-Chats werden nur in deinem Browser verarbeitet und niemals an den Entwickler gesendet.",
      sourceCode: "Open-Source-Code (MIT)",
      resizeChatListAria: "Breite der Chatliste ändern",
      saved: "Gespeichert",
      saveFailed: "Die Einstellung konnte nicht gespeichert werden",
      allChatsAria: "Alle Grok-Chats",
      untitledChat: "Ohne Titel",
      chatMenuAria: "Chat-Menü: {title}",
      openNewTab: "In neuem Tab öffnen",
      rename: "Umbenennen",
      pin: "Anheften",
      unpin: "Nicht mehr anheften",
      delete: "Löschen",
      renamePrompt: "Neuer Chatname",
      deleteConfirm: "Chat „{title}“ löschen?",
      unknownError: "unbekannter Fehler",
      renameError: "Der Chat konnte nicht umbenannt werden: {message}",
      pinError: "Der Chat konnte nicht angeheftet werden: {message}",
      unpinError: "Die Anheftung des Chats konnte nicht aufgehoben werden: {message}",
      deleteError: "Der Chat konnte nicht gelöscht werden: {message}",
      pinned: "Angeheftet",
      history: "Verlauf",
      partialHistoryError: "Ein Teil des Verlaufs konnte nicht geladen werden",
      historyError: "Der Verlauf konnte nicht geladen werden",
      loadingHistory: "Verlauf wird geladen...",
      waitingHistory: "Verlauf wird vorbereitet...",
      signedInRequired: "Melde dich bei Grok an, um deine Chats anzuzeigen.",
      noChats: "Keine Chats gefunden.",
      historyTooLarge: "Der Verlauf ist zu groß, um ihn in einem Durchgang zu laden"
    },
    "pt-BR": {
      extensionName: "Barra lateral de chats para Grok",
      extensionDescription: "Extensão não oficial e de código aberto que mostra todo o histórico de chats do Grok na barra lateral.",
      openSettings: "Abrir configurações da extensão",
      languageLabel: "Idioma da interface",
      automaticLanguage: "Automático (navegador)",
      privacyNotice: "Extensão não oficial. Os títulos e metadados dos chats do Grok são processados somente no seu navegador e nunca são enviados ao desenvolvedor.",
      sourceCode: "Código aberto (MIT)",
      resizeChatListAria: "Redimensionar lista de chats",
      saved: "Salvo",
      saveFailed: "Não foi possível salvar a configuração",
      allChatsAria: "Todos os chats do Grok",
      untitledChat: "Sem título",
      chatMenuAria: "Menu do chat: {title}",
      openNewTab: "Abrir em nova aba",
      rename: "Renomear",
      pin: "Fixar",
      unpin: "Desafixar",
      delete: "Excluir",
      renamePrompt: "Novo nome do chat",
      deleteConfirm: "Excluir o chat “{title}”?",
      unknownError: "erro desconhecido",
      renameError: "Não foi possível renomear o chat: {message}",
      pinError: "Não foi possível fixar o chat: {message}",
      unpinError: "Não foi possível desafixar o chat: {message}",
      deleteError: "Não foi possível excluir o chat: {message}",
      pinned: "Fixados",
      history: "Histórico",
      partialHistoryError: "Não foi possível carregar parte do histórico",
      historyError: "Não foi possível carregar o histórico",
      loadingHistory: "Carregando histórico...",
      waitingHistory: "Aguardando o histórico...",
      signedInRequired: "Entre no Grok para ver seus chats.",
      noChats: "Nenhum chat encontrado.",
      historyTooLarge: "O histórico é grande demais para ser carregado de uma só vez"
    },
    ru: {
      extensionName: "Панель всех чатов для Grok",
      extensionDescription: "Неофициальное расширение с открытым исходным кодом, показывающее всю историю чатов Grok на боковой панели.",
      openSettings: "Открыть настройки расширения",
      languageLabel: "Язык интерфейса",
      automaticLanguage: "Автоматически (браузер)",
      privacyNotice: "Неофициальное расширение. Названия и метаданные чатов Grok обрабатываются только в вашем браузере и никогда не отправляются разработчику.",
      sourceCode: "Открытый исходный код (MIT)",
      resizeChatListAria: "Изменить ширину списка чатов",
      saved: "Сохранено",
      saveFailed: "Не удалось сохранить настройку",
      allChatsAria: "Все чаты Grok",
      untitledChat: "Без названия",
      chatMenuAria: "Меню чата: {title}",
      openNewTab: "Открыть в новой вкладке",
      rename: "Переименовать",
      pin: "Закрепить",
      unpin: "Открепить",
      delete: "Удалить",
      renamePrompt: "Новое название чата",
      deleteConfirm: "Удалить чат «{title}»?",
      unknownError: "неизвестная ошибка",
      renameError: "Не удалось переименовать чат: {message}",
      pinError: "Не удалось закрепить чат: {message}",
      unpinError: "Не удалось открепить чат: {message}",
      deleteError: "Не удалось удалить чат: {message}",
      pinned: "Закреплённые",
      history: "История",
      partialHistoryError: "Часть истории не загрузилась",
      historyError: "История не загрузилась",
      loadingHistory: "Загружаю историю...",
      waitingHistory: "Ожидание истории...",
      signedInRequired: "Войдите в аккаунт Grok, чтобы увидеть чаты.",
      noChats: "Чаты не найдены.",
      historyTooLarge: "История слишком большая для одного прохода"
    },
    uk: {
      extensionName: "Панель усіх чатів для Grok",
      extensionDescription: "Неофіційне розширення з відкритим кодом, що показує всю історію чатів Grok на бічній панелі.",
      openSettings: "Відкрити налаштування розширення",
      languageLabel: "Мова інтерфейсу",
      automaticLanguage: "Автоматично (браузер)",
      privacyNotice: "Неофіційне розширення. Назви й метадані чатів Grok обробляються лише у вашому браузері та ніколи не надсилаються розробнику.",
      sourceCode: "Відкритий вихідний код (MIT)",
      resizeChatListAria: "Змінити ширину списку чатів",
      saved: "Збережено",
      saveFailed: "Не вдалося зберегти налаштування",
      allChatsAria: "Усі чати Grok",
      untitledChat: "Без назви",
      chatMenuAria: "Меню чату: {title}",
      openNewTab: "Відкрити в новій вкладці",
      rename: "Перейменувати",
      pin: "Закріпити",
      unpin: "Відкріпити",
      delete: "Видалити",
      renamePrompt: "Нова назва чату",
      deleteConfirm: "Видалити чат «{title}»?",
      unknownError: "невідома помилка",
      renameError: "Не вдалося перейменувати чат: {message}",
      pinError: "Не вдалося закріпити чат: {message}",
      unpinError: "Не вдалося відкріпити чат: {message}",
      deleteError: "Не вдалося видалити чат: {message}",
      pinned: "Закріплені",
      history: "Історія",
      partialHistoryError: "Частину історії не вдалося завантажити",
      historyError: "Не вдалося завантажити історію",
      loadingHistory: "Завантаження історії...",
      waitingHistory: "Очікування історії...",
      signedInRequired: "Увійдіть в обліковий запис Grok, щоб переглянути чати.",
      noChats: "Чатів не знайдено.",
      historyTooLarge: "Історія завелика для завантаження за один прохід"
    },
    fr: {
      extensionName: "Barre latérale des chats pour Grok",
      extensionDescription: "Extension non officielle et open source qui affiche l’historique complet des chats Grok dans la barre latérale.",
      openSettings: "Ouvrir les paramètres de l’extension",
      languageLabel: "Langue de l’interface",
      automaticLanguage: "Automatique (navigateur)",
      privacyNotice: "Extension non officielle. Les titres et métadonnées des chats Grok sont traités uniquement dans votre navigateur et ne sont jamais envoyés au développeur.",
      sourceCode: "Code open source (MIT)",
      resizeChatListAria: "Redimensionner la liste des chats",
      saved: "Enregistré",
      saveFailed: "Impossible d’enregistrer le paramètre",
      allChatsAria: "Tous les chats Grok",
      untitledChat: "Sans titre",
      chatMenuAria: "Menu du chat : {title}",
      openNewTab: "Ouvrir dans un nouvel onglet",
      rename: "Renommer",
      pin: "Épingler",
      unpin: "Désépingler",
      delete: "Supprimer",
      renamePrompt: "Nouveau nom du chat",
      deleteConfirm: "Supprimer le chat « {title} » ?",
      unknownError: "erreur inconnue",
      renameError: "Impossible de renommer le chat : {message}",
      pinError: "Impossible d’épingler le chat : {message}",
      unpinError: "Impossible de désépingler le chat : {message}",
      deleteError: "Impossible de supprimer le chat : {message}",
      pinned: "Épinglés",
      history: "Historique",
      partialHistoryError: "Une partie de l’historique n’a pas pu être chargée",
      historyError: "Impossible de charger l’historique",
      loadingHistory: "Chargement de l’historique...",
      waitingHistory: "En attente de l’historique...",
      signedInRequired: "Connectez-vous à Grok pour afficher vos chats.",
      noChats: "Aucun chat trouvé.",
      historyTooLarge: "L’historique est trop volumineux pour être chargé en une seule fois"
    }
  };

  for (const catalog of Object.values(translations)) {
    Object.freeze(catalog);
  }
  Object.freeze(translations);

  function languageFromLocale(value) {
    const locale = String(value || "").trim().replace(/_/g, "-").toLowerCase();
    if (!locale) {
      return "";
    }
    if (locale === "pt" || locale.startsWith("pt-")) {
      return "pt-BR";
    }

    const baseLanguage = locale.split("-")[0];
    return SUPPORTED_LANGUAGES.find((language) => language.toLowerCase() === baseLanguage) || "";
  }

  function normalizePreference(value) {
    if (String(value || "").toLowerCase() === "auto") {
      return "auto";
    }
    return languageFromLocale(value) || "auto";
  }

  function resolveLanguage(preference, candidates = []) {
    const normalizedPreference = normalizePreference(preference);
    if (normalizedPreference !== "auto") {
      return normalizedPreference;
    }

    const localeCandidates = Array.isArray(candidates) ? candidates : [candidates];
    for (const candidate of localeCandidates) {
      const language = languageFromLocale(candidate);
      if (language) {
        return language;
      }
    }
    return "en";
  }

  function translate(language, key, replacements = {}) {
    const resolvedLanguage = languageFromLocale(language) || "en";
    const template = translations[resolvedLanguage]?.[key] ?? translations.en[key] ?? key;
    return String(template).replace(/\{([a-zA-Z0-9_]+)\}/g, (match, replacementKey) => {
      return Object.prototype.hasOwnProperty.call(replacements, replacementKey)
        ? String(replacements[replacementKey])
        : match;
    });
  }

  globalThis.GrokShowAllChatsI18n = Object.freeze({
    LANGUAGE_ATTRIBUTE,
    LANGUAGE_CHANGE_EVENT,
    LANGUAGE_NAMES,
    STORAGE_KEY,
    SUPPORTED_LANGUAGES,
    normalizePreference,
    resolveLanguage,
    translate,
    translations
  });
})();
