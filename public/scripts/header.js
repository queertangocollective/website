(function () {
  let header = document.querySelector('header');
  let logo = document.querySelector('#logo img');
  let h5 = document.querySelector('header h5');
  let textLogo = document.querySelector('#text-logo');
  let height = header.clientHeight;

  document.addEventListener('scroll', function () {
    requestAnimationFrame(animateHeader);
  }, { passive: true });
  
  document.addEventListener('wheel', function () {
    requestAnimationFrame(animateHeader);
  }, { passive: true });
  
  function animateHeader() {
    let top = document.scrollingElement.scrollTop;
    let headerHeight = Math.max((height - top), 80);
    header.style.height = headerHeight + 'px';
    h5.style.height = Math.max((height - top - 46), 34) + 'px';
    if (headerHeight === 80) {
      logo.style.opacity = 0;
    } else {
      logo.style.opacity = (height - top - 80) / (height - 80);
    }
    if ((height - top - 80) < 0) {
      textLogo.classList.add('visible');
    } else {
      textLogo.classList.remove('visible');
    }
  }
})();
