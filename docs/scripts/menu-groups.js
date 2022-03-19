'use strict';

(() => {
  function toggleNavigationBar() {
    const navigationElements = document.querySelectorAll('.navigation');
    for (const navigationElement of navigationElements) {
      navigationElement.classList.toggle('open');
    }
  }

  // Hamburger button - toggles the navigation bar
  const hamburger = document.querySelector('#navigationHamburger');
  hamburger.addEventListener('click', () => {
    toggleNavigationBar();
  });

  // Each link in the navigation bar - closes the navigation bar
  const navigationLinks = document.querySelectorAll('.navigation a');
  for (const linkElement of navigationLinks) {
    linkElement.addEventListener('click', () => {
      toggleNavigationBar();
    });
  }
})();
