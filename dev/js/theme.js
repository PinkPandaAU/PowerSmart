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
    const map = [];
    heading.querySelectorAll(".no-split").forEach((el, i) => {
      const key = `__NOSPLIT_${i}__`;
      map.push({ key, el });
      el.outerHTML = key;
    });

    const split = new SplitText(heading, {
      type: "words",
      wordsClass: "single-word",
    });

    map.forEach(({ key, el }) => {
      heading.innerHTML = heading.innerHTML.replace(key, el.outerHTML);
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

      // ============================================
      // CART MODAL LOGIC - Load Latest Cart Item
      // ============================================
      if (modal.id === 'modalCart') {
        fetch('/cart.js')
          .then(response => response.json())
          .then(cart => {
            if (cart.items.length > 0) {
              updateCartModalWithAllItems(cart.items);
            }
            else {
              showEmptyCart();
            }
          })
          .catch(error => {
            console.error('Error fetching cart:', error);
          });
      }

      // ============================================
      // VIDEO MODAL LOGIC - Load Video
      // ============================================
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

// ============================================
// ADD TO CART FUNCTIONALITY
// ============================================
if (document.querySelector(".btn-cart")) {
  document.querySelectorAll(".btn-cart").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      
      if (btn.disabled) return;

      btn.disabled = true;
      showLoader(btn);

      const form = btn.closest("form");
      const variantId = form.querySelector('input[name="id"]').value;
      const quantity = form.querySelector('input[name="quantity"]')?.value || 1;

      fetch('/cart/add.js', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest'
        },
        body: JSON.stringify({
          items: [
            {
              id: variantId,
              quantity: parseInt(quantity)
            }
          ]
        })
      })
      .then(response => response.json())
      .then(cartData => {
        updateHeaderCartNumber();
        
        // Fetch all cart items after adding
        fetch('/cart.js')
          .then(response => response.json())
          .then(allCartData => {
            updateCartModalWithAllItems(allCartData.items);
            openCartModal();
            
            setTimeout(() => {
              resetButton(btn);
            }, 500);
          })
          .catch(error => {
            console.error('Error fetching cart:', error);
            resetButton(btn);
          });
      })
      .catch(error => {
        console.error('Cart error:', error);
        alert("Error adding to cart. Please try again.");
        resetButton(btn);
      });
    });
  });
}
// ============================================
// HELPER FUNCTIONS
// ============================================
function showLoader(btn) {
  btn.classList.add('is-loading');
  const loader = btn.querySelector('.btn-cart__loader');
  if (loader) {
    loader.style.display = 'flex';
  }
}

function resetButton(btn) {
  btn.disabled = false;
  btn.classList.remove('is-loading');
  const loader = btn.querySelector('.btn-cart__loader');
  if (loader) {
    loader.style.display = 'none';
  }
}

// Update cart number in header
function updateHeaderCartNumber() {
  fetch('/cart.js')
    .then(response => response.json())
    .then(cart => {
      const cartNumber = document.querySelector('.header__cart-number');
      if (cartNumber) {
        cartNumber.textContent = cart.item_count;
        cartNumber.style.display = cart.item_count > 0 ? 'inline' : 'none';
      }
    })
    .catch(error => {
      console.error('Error updating cart number:', error);
    });
}


// ============================================
// UPDATE CART MODAL WITH ALL ITEMS
// ============================================
function updateCartModalWithAllItems(items) {
  const modal = document.getElementById('modalCart');
  if (!modal) return;

  const cartItemsContainer = modal.querySelector('.cart-items-container');
  if (!cartItemsContainer) {
    console.warn('Cart items container not found');
    return;
  }

  // Clear existing items
  cartItemsContainer.innerHTML = '';

  let totalPrice = 0;

  // Loop through each item and create HTML
  items.forEach(item => {
    const itemPrice = (item.final_price / 100).toFixed(2);
    const itemLinePrice = (item.final_line_price / 100).toFixed(2);
    totalPrice += item.final_line_price;

    // In updateCartModalWithAllItems function, change:
    const itemHTML = `
      <div class="cart-item">
        <figure>
          <img src="${item.image}" alt="${item.title}" />
        </figure>
        <div class="cart-item-details">
          <div class="cart-item-title">${item.title}${item.variant_title ? ` (${item.variant_title})` : ''}</div>
          <div class="product-details__number">
            <div class="product-number">
              <button type="button" class="product-number-less">
                <svg width="10" height="2" viewBox="0 0 10 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0.75 0.75H8.75" stroke="#002341" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
              <input type="text" class="product-number-input" value="${item.quantity}" data-line="${items.indexOf(item) + 1}" />
              <button type="button" class="product-number-more">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M4.75 0.75V8.75" stroke="#002341" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
                <path d="M0.75 4.75H8.75" stroke="#002341" stroke-width="1.5" stroke-miterlimit="10" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              </button>
            </div>
            <div class="product-details__price">$${itemPrice}</div>
          </div>
        </div>
      </div>
    `;

    cartItemsContainer.innerHTML += itemHTML;
  });

  // Update cart total
  const totalPrice_formatted = (totalPrice / 100).toFixed(2);
  const cartTotal = modal.querySelector('.cart-total');
  const emptyCart = modal.querySelector('.cart-empty');
  const checkoutBtn = modal.querySelector('.btn--checkout');

  if (items.length > 0) {
    if (cartTotal) {
      cartTotal.innerHTML = `<strong>Subtotal:</strong> $${totalPrice_formatted}`;
      cartTotal.style.display = 'block';  // Show Total
    } 
    if (checkoutBtn) checkoutBtn.style.display = 'inline-flex';  // Show button
    if (emptyCart) emptyCart.style.display = 'none';  // Hide Empty cart
  } else {
    if (cartTotal) cartTotal.style.display = 'none';   // Hide Total
    if (checkoutBtn) checkoutBtn.style.display = 'none';   // Hide button
    if (emptyCart) emptyCart.style.display = 'flex';  // Show Empty cart
  }
}


function showEmptyCart() {
  const modal = document.getElementById('modalCart');
  if (!modal) return;

  const cartItemsContainer = modal.querySelector('.cart-items-container');
  const cartTotal = modal.querySelector('.cart-total');
  const checkoutBtn = modal.querySelector('.btn--checkout');
  const emptyCart = modal.querySelector('.cart-empty');

  if (cartItemsContainer) cartItemsContainer.innerHTML = '';
  if (cartTotal) cartTotal.style.display = 'none';   // Hide Total
  if (checkoutBtn) checkoutBtn.style.display = 'none';   // Hide button
  if (emptyCart) emptyCart.style.display = 'flex';  // Show Empty cart
}


// Open the cart modal
function openCartModal() {
  const modal = document.getElementById('modalCart');
  if (!modal) return;

  modal.style.display = 'block';

  setTimeout(() => {
    modal.classList.add('opening');
  }, 10);
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

// Debounce function
function debounce(func, delay) {
  let timeoutId;
  return function(...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

// Create debounced update function
const debouncedUpdateQuantity = debounce(function(lineNumber, newQuantity, element) {
  updateCartItemQuantity(lineNumber, newQuantity, element);
}, 500); // 500ms delay

// Event delegation for dynamically added product quantity controls
document.addEventListener("click", (e) => {
  const btnPlus = e.target.closest(".cart-item .product-number-more");
  const btnMinus = e.target.closest(".cart-item .product-number-less");

  if (btnPlus) {
    const counter = btnPlus.closest(".product-number");
    const input = counter.querySelector(".product-number-input");
    const lineNumber = input.dataset.line;
    
    input.value = parseInt(input.value || 1, 10) + 1;
    debouncedUpdateQuantity(lineNumber, parseInt(input.value, 10), btnPlus);
  }

  if (btnMinus) {
    const counter = btnMinus.closest(".product-number");
    const input = counter.querySelector(".product-number-input");
    const lineNumber = input.dataset.line;
    
    const current = parseInt(input.value || 1, 10);
    
    // Check if quantity is 1, don't allow minus
    if (current <= 1) {
      return;
    }
    
    input.value = current - 1;
    debouncedUpdateQuantity(lineNumber, parseInt(input.value, 10), btnMinus);
  }
});

// Handle direct input changes in quantity field
document.addEventListener("input", (e) => {
  if (e.target.classList.contains("product-number-input")) {
    const input = e.target;
    const lineNumber = input.dataset.line;
    
    let val = parseInt(input.value, 10);
    if (isNaN(val) || val < 1) {
      input.value = 1;
      val = 1;
      return;
    }
    
    debouncedUpdateQuantity(lineNumber, val, input);
  }
});

// Update cart item quantity via Shopify API
function updateCartItemQuantity(lineNumber, newQuantity, element) {
  fetch('/cart/change.js', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Requested-With': 'XMLHttpRequest'
    },
    body: JSON.stringify({
      line: parseInt(lineNumber),
      quantity: newQuantity
    })
  })
  .then(response => {
    return response.json();
  })
  .then(cart => {
    updateHeaderCartNumber();
    updateCartTotal(cart.items);
    updateItemPricesInModal(cart.items);
  })
  .catch(error => {
    console.error('Error details:', error.message);
  });
}
// Update individual item prices in modal without reloading all items
function updateItemPricesInModal(items) {
  if (!items || !Array.isArray(items)) return;

  items.forEach((item, index) => {
    // Use index + 1 as line number (Shopify counts from 1)
    const lineNumber = index + 1;
    const itemInput = document.querySelector(`.product-number-input[data-line="${lineNumber}"]`);
    
    if (itemInput) {
      const cartItem = itemInput.closest('.cart-item');
      if (cartItem) {
        // Update quantity
        itemInput.value = item.quantity;
        
        // Update item line price
        const itemLinePrice = (item.final_line_price / 100).toFixed(2);
        const cartItemPrice = cartItem.querySelector('.cart-item-price');
        if (cartItemPrice) {
          cartItemPrice.textContent = `$${itemLinePrice}`;
        }
      }
    }
  });
}
// Update cart total in modal
function updateCartTotal(items) {
  if (!items || !Array.isArray(items)) return;
  
  let totalPrice = 0;
  
  items.forEach(item => {
    totalPrice += item.final_line_price;
  });

  const totalPrice_formatted = (totalPrice / 100).toFixed(2);
  const cartTotal = document.querySelector('.cart-total');
  
  if (cartTotal) {
    cartTotal.innerHTML = `<strong>Subtotal:</strong> $${totalPrice_formatted}`;
  }
}


document.addEventListener("DOMContentLoaded", function () {
    const minusBtn = document.querySelector(".single-product .product-number-less");
    const plusBtn = document.querySelector(".single-product .product-number-more");
    const qtyInput = document.querySelector(".single-product .product-number-input");

    minusBtn.addEventListener("click", function () {
      let current = parseInt(qtyInput.value) || 1;
      if (current > 1) {
        qtyInput.value = current - 1;
      }
    });

    plusBtn.addEventListener("click", function () {
      let current = parseInt(qtyInput.value) || 1;
      qtyInput.value = current + 1;
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

if (document.querySelector(".tabs")) {
  const tabLinks = document.querySelectorAll(".tab-link");
  const tabContents = document.querySelectorAll(".tab-content");

  tabLinks.forEach((tab) => {
    tab.addEventListener("click", function () {
      tabLinks.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      this.classList.add("active");
      document.getElementById(this.dataset.tab).classList.add("active");
    });
  });
}
