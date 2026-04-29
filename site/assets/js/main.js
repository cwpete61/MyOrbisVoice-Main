// Mobile nav toggle
const burger = document.getElementById('nav-burger');
const mobileNav = document.getElementById('nav-mobile');
if (burger && mobileNav) {
  burger.addEventListener('click', () => mobileNav.classList.toggle('open'));
}

// Active nav link
document.querySelectorAll('.nav-links a, .nav-mobile a').forEach(link => {
  if (link.href === window.location.href) link.classList.add('active');
});

// FAQ accordion
document.querySelectorAll('.faq-item').forEach(item => {
  item.querySelector('.faq-q')?.addEventListener('click', () => {
    const isOpen = item.classList.contains('open');
    document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('open'));
    if (!isOpen) item.classList.add('open');
  });
});

// Channel tabs
document.querySelectorAll('.channel-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const target = tab.dataset.tab;
    document.querySelectorAll('.channel-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.channel-panel').forEach(p => p.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(target)?.classList.add('active');
  });
});

// Smooth reveal on scroll
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('revealed'); observer.unobserve(e.target); } });
}, { threshold: 0.1 });
document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
