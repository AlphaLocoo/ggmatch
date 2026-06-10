// Curseur personnalisé partagé par toutes les pages Match
(function () {
  var cursor = document.getElementById('cursor');
  var follower = document.getElementById('cursorFollower');
  var mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;

  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX; mouseY = e.clientY;
    if (cursor) cursor.style.transform = 'translate(' + (mouseX - 6) + 'px, ' + (mouseY - 6) + 'px)';
  });

  function animateFollower() {
    followerX += (mouseX - followerX - 20) * 0.1;
    followerY += (mouseY - followerY - 20) * 0.1;
    if (follower) follower.style.transform = 'translate(' + followerX + 'px, ' + followerY + 'px)';
    requestAnimationFrame(animateFollower);
  }
  animateFollower();
})();
