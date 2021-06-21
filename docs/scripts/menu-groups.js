'use strict';

(() => {
  function toggleNavigationBar() {
    const navigationElements = document.getElementsByClassName('navigation');
    for (let i = 0; i < navigationElements.length; ++i) {
      const navigationElement = navigationElements[i];
      navigationElement.classList.toggle('open');
    }
  }

  // Hamburger button - toggles the navigation bar
  const hamburger = document.getElementById('navigationHamburger');
  hamburger.addEventListener('click', () => {
    toggleNavigationBar();
  });

  // Each link in the navigation bar - closes the navigation bar
  const navigationLinks = document.querySelectorAll('.navigation a');
  for (let i = 0; i < navigationLinks.length; ++i) {
    const linkElement = navigationLinks[i];
    linkElement.addEventListener('click', () => {
      toggleNavigationBar();
    });
  }
})();
