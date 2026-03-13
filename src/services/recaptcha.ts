type GrecaptchaExecuteOptions = {
  action: string;
};

type Grecaptcha = {
  ready: (callback: () => void) => void;
  execute: (
    siteKey: string,
    options: GrecaptchaExecuteOptions,
  ) => Promise<string>;
};

declare global {
  interface Window {
    grecaptcha?: Grecaptcha;
  }
}

const RECAPTCHA_SCRIPT_ID = "recaptcha-v3-script";
const RECAPTCHA_SITE_KEY = import.meta.env.VITE_RECAPTCHA_SITE_KEY?.trim() ?? "";

let recaptchaScriptPromise: Promise<void> | null = null;

export const isRecaptchaConfigured = () => RECAPTCHA_SITE_KEY.length > 0;

const loadRecaptchaScript = async (): Promise<void> => {
  if (!isRecaptchaConfigured()) {
    throw new Error("reCAPTCHA site key topilmadi.");
  }

  if (window.grecaptcha) return;

  if (recaptchaScriptPromise) {
    await recaptchaScriptPromise;
    return;
  }

  recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.getElementById(
      RECAPTCHA_SCRIPT_ID,
    ) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("reCAPTCHA script yuklanmadi.")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = RECAPTCHA_SCRIPT_ID;
    script.src = `https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(
      RECAPTCHA_SITE_KEY,
    )}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("reCAPTCHA script yuklanmadi."));
    document.head.appendChild(script);
  });

  await recaptchaScriptPromise;
};

export const initializeRecaptcha = async (): Promise<void> => {
  await loadRecaptchaScript();
  if (!window.grecaptcha) {
    throw new Error("reCAPTCHA obyekti topilmadi.");
  }

  await new Promise<void>((resolve) => {
    window.grecaptcha?.ready(() => resolve());
  });
};

export const getRecaptchaToken = async (action: string): Promise<string> => {
  await initializeRecaptcha();

  return new Promise<string>((resolve, reject) => {
    window.grecaptcha?.ready(() => {
      window.grecaptcha
        ?.execute(RECAPTCHA_SITE_KEY, { action })
        .then((token) => {
          if (!token) {
            reject(new Error("reCAPTCHA token bo'sh qaytdi."));
            return;
          }
          resolve(token);
        })
        .catch(() => reject(new Error("reCAPTCHA token olishda xatolik.")));
    });
  });
};
