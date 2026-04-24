const lenis = new Lenis();

lenis.on("scroll", ScrollTrigger.update);

gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
});

gsap.ticker.lagSmoothing(0);

window.addEventListener("load", () => {
  ScrollTrigger.refresh();

  if (typeof lenis !== "undefined" && lenis.update) {
    lenis.update();
  }
});

// topbar
const topbar = document.querySelector(".header__bar");

function setTopbarHeight() {
  const topbar_height = topbar ? topbar.clientHeight : 0;
  document.querySelector("body").style.setProperty("--topbar", topbar_height + "px");
}

(function () {
  if (topbar) {
    setTimeout(function () {
      topbar.classList.add("is-shown");
      setTopbarHeight();
    }, 3000);

    window.addEventListener("resize", () => {
      setTopbarHeight();
    });
  }
})();

// IntersectionObserver (in view detection)
const observer = new IntersectionObserver(
  (entries, observer) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        $item = entry.target;
        $item.classList.add("in-view");
      }
    });
  },
  {
    root: null,
    threshold: 0,
  },
);

window.addEventListener("load", () => {
  const elements = document.querySelectorAll(".fade-in, .fade-in-wrapper > *");

  elements.forEach((el) => {
    observer.observe(el);

    const rect = el.getBoundingClientRect();
    if (rect.top < window.innerHeight) {
      el.classList.add("in-view");
    }
  });
});

// headroom
var header = document.querySelector(".header");
var headroom = new Headroom(header, {
  offset: header.clientHeight,
});
headroom.init();

// mobile menu
let wasPinned = false;
function navClose() {
  document.querySelector(".navbar-toggler").classList.remove("active");
  document.querySelector(".header").classList.remove("nav-opened");
  document.querySelector(".header__nav").classList.remove("active");
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      headroom.unfreeze();
    });
  });
}

function navOpen() {
  headroom.freeze();
  document.querySelector(".navbar-toggler").classList.add("active");
  document.querySelector(".header").classList.add("nav-opened");
  document.querySelector(".header__nav").classList.add("active");
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelector(".header .navbar-toggler").addEventListener("click", function () {
    this.classList.contains("active") ? navClose() : navOpen();
  });
});

// anchors
const anchorLinks = document.querySelectorAll('.link[href*="#"]');
const navLinks = document.querySelectorAll('.header__nav .link[href*="#"]');
const sections = document.querySelectorAll("section[id]");

anchorLinks.forEach((link) => {
  link.addEventListener("click", function (e) {
    const href = this.getAttribute("href");

    const [url, hash] = href.split("#");

    const isSamePage = !url || url === window.location.pathname.split("/").pop();

    // const isSamePage = !url || window.location.href.includes(url); - update for WP

    if (!hash) return;

    if (isSamePage) {
      e.preventDefault();

      const target = document.querySelector(`#${hash}`);
      if (!target) return;

      const isInNav = this.closest(".header__nav");

      if (isInNav) {
        navClose();

        navLinks.forEach((l) => l.classList.remove("current"));
        this.classList.add("current");
      }

      const delay = isInNav ? 300 : 0;

      setTimeout(() => {
        lenis.scrollTo(target, {
          duration: 1.2,
        });
      }, delay);
    }
  });
});

window.addEventListener("load", () => {
  const hash = window.location.hash;

  if (hash) {
    const target = document.querySelector(hash);

    if (target) {
      setTimeout(() => {
        lenis.scrollTo(target, { duration: 1.2 });
      }, 100);
    }
  }
});

const observerNav = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const id = entry.target.id;

      navLinks.forEach((link) => {
        const href = link.getAttribute("href");
        const hash = href.includes("#") ? href.split("#")[1] : "";

        link.classList.toggle("current", hash === id);
      });
    });
  },
  {
    rootMargin: "-30% 0px -70% 0px",
    threshold: 0,
  },
);

sections.forEach((section) => observerNav.observe(section));

// headlines animation
CustomEase.create("elastic-css", ".2, 1.33, .25 ,1");

function initSplitText() {
  document.querySelectorAll("h1, h2, h3").forEach((heading) => {
    const split = new SplitText(heading, {
      type: "words",
      wordsClass: "single-word",
    });

    heading.querySelectorAll(".single-word").forEach((el) => {
      const wrapper = document.createElement("div");
      wrapper.className = "single-word-inner";

      while (el.firstChild) {
        wrapper.appendChild(el.firstChild);
      }

      el.appendChild(wrapper);
    });

    gsap.to(heading.querySelectorAll(".single-word-inner"), {
      y: 0,
      rotate: 0.001,
      stagger: 0.02,
      duration: 0.8,
      ease: "elastic-css",
      scrollTrigger: {
        trigger: heading,
        start: "top 80%",
      },
    });
  });
}

initSplitText();

// parallax
let parallaxAmount = window.innerHeight * 0.02;
if (window.innerWidth < 1080) {
  parallaxAmount = window.innerHeight * 0.01;
}
document.querySelectorAll(".img-parallax").forEach((parallax) => {
  gsap.to(parallax.querySelector("img"), {
    y: parallaxAmount,
    scrollTrigger: {
      trigger: parallax,
      start: "top bottom",
      end: "bottom top",
      scrub: 1,
    },
  });
});

// modals
if (document.querySelector("[data-toggle='modal']")) {
  const triggers = document.querySelectorAll("[data-toggle='modal']");

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (e) => {
      e.preventDefault();

      const targetSelector = trigger.getAttribute("data-target") || trigger.getAttribute("href");
      const modal = document.querySelector(targetSelector);
      if (!modal) return;

      modal.style.display = "block";

      setTimeout(() => {
        modal.classList.add("opening");
      }, 10);

      const videoSrc = trigger.getAttribute("data-src");
      if (videoSrc) {
        const iframe = modal.querySelector("iframe");
        if (iframe) {
          let src = videoSrc;

          if (src.includes("youtube.com") || src.includes("youtu.be")) {
            const separator = src.includes("?") ? "&" : "?";
            src = src + separator + "autoplay=1&mute=1&rel=0&enablejsapi=1&modestbranding=1";
          }

          setTimeout(() => {
            iframe.src = src;
          }, 300);
        }
      }
    });
  });

  document.querySelectorAll(".modal").forEach((modal) => {
    const closeModal = () => {
      const iframe = modal.querySelector("iframe");
      if (iframe) iframe.src = "";

      modal.classList.remove("opening");

      setTimeout(() => {
        modal.style.display = "none";
      }, 500);
    };

    const closeBtn = modal.querySelector(".modal__close");
    if (closeBtn) {
      closeBtn.addEventListener("click", closeModal);
    }

    const backdrop = modal.querySelector(".modal__backdrop");
    if (backdrop) {
      backdrop.addEventListener("click", closeModal);
    }
  });
}

// PhotoSwipe
var lightbox = new PhotoSwipeLightbox({
  gallery: ".global-wrapper",
  children: ".gallery",
  pswpModule: PhotoSwipe,
  preload: [1, 2],
  showHideAnimationType: "zoom",
  showAnimationDuration: 500,
  hideAnimationDuration: 500,
  zoomAnimationDuration: 500,
});
lightbox.on("firstUpdate", () => {
  document.querySelectorAll(".pswp__img").forEach((img) => {
    img.style.transform = "translate3d(0,0,0)";
  });
});
lightbox.init();

// add to cart
if (document.querySelector(".btn-cart")) {
  document.querySelectorAll(".btn-cart").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.disabled) return;

      btn.disabled = true;

      setTimeout(() => {
        alert("Added to cart!");
        btn.disabled = false;
      }, 3000);
    });
  });
}

// accordion
document.addEventListener("DOMContentLoaded", () => {
  const accordions = document.querySelectorAll(".accordion");
  if (!accordions.length) return;

  accordions.forEach((accordion) => {
    const items = accordion.querySelectorAll(".accordion__item");

    items.forEach((item) => {
      const button = item.querySelector(".accordion__item-button");
      const body = item.querySelector(".accordion__item-body");
      const inner = item.querySelector(".accordion__item-inner");

      button.addEventListener("click", () => {
        const isOpen = item.classList.contains("active");

        items.forEach((otherItem) => {
          if (otherItem !== item) {
            otherItem.classList.remove("active");
            const otherBody = otherItem.querySelector(".accordion__item-body");
            otherBody.style.maxHeight = null;
          }
        });

        if (isOpen) {
          item.classList.remove("active");
          body.style.maxHeight = null;
        } else {
          item.classList.add("active");
          body.style.maxHeight = inner.scrollHeight + "px";
        }
      });
    });
  });
});

// copy current url
const btnCopy = document.querySelector(".btn-copy");
if (btnCopy) {
  btnCopy.addEventListener("click", function () {
    const $this = this;
    const locationUrl = window.location.href;
    navigator.clipboard.writeText(locationUrl).then(() => {
      $this.classList.add("active");

      setTimeout(() => {
        $this.classList.remove("active");
      }, 5000);
    });
  });
}

const productSliderEl = document.querySelector(".product-slider.swiper");

if (productSliderEl) {
  const swiperProduct = new Swiper(productSliderEl, {
    loop: true,

    slidesPerView: 1.4,
    spaceBetween: 16,

    navigation: {
      nextEl: ".swiper-button-next",
      prevEl: ".swiper-button-prev",
    },

    breakpoints: {
      768: {
        slidesPerView: 1,
        spaceBetween: 0,
      },
    },
  });
}

document.querySelectorAll(".product-number").forEach((counter) => {
  const input = counter.querySelector(".product-number-input");
  const btnMinus = counter.querySelector(".product-number-less");
  const btnPlus = counter.querySelector(".product-number-more");

  btnPlus.addEventListener("click", () => {
    input.value = parseInt(input.value || 1, 10) + 1;
  });

  btnMinus.addEventListener("click", () => {
    const current = parseInt(input.value || 1, 10);
    input.value = Math.max(1, current - 1);
  });

  input.addEventListener("input", () => {
    let val = parseInt(input.value, 10);
    if (isNaN(val) || val < 1) input.value = 1;
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("accountDetailsForm");
  if (!form) return;

  const inputs = form.querySelectorAll(".form-control");
  const submitBtn = form.querySelector('button[type="submit"]');

  const initialValues = {};
  inputs.forEach((input) => {
    initialValues[input.id] = input.value.trim();
  });

  const checkChanges = () => {
    let changed = false;

    inputs.forEach((input) => {
      if (input.value.trim() !== initialValues[input.id]) {
        changed = true;
      }
    });

    submitBtn.disabled = !changed;
  };

  inputs.forEach((input) => {
    input.addEventListener("input", checkChanges);
  });
});
