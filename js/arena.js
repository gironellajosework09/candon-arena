(
  function(){
  "use strict";

  var MAX_SEATS = 5;
  var STORAGE_KEY = "candon_arena_booked_seats_v1";

  var stage = document.getElementById('stage');
  var svgEl = stage.querySelector('svg');
  var viewport = document.getElementById('viewport');
  var canvas = document.getElementById('canvas');
  var tooltip = document.getElementById('tooltip');
  var ttCode = document.getElementById('ttCode');
  var ttStatus = document.getElementById('ttStatus');
  var toastEl = document.getElementById('toast');

  var allSeats = Array.prototype.slice.call(document.querySelectorAll('.seat'));

  // ---------- database seat status ----------
  var seatStatus = {}; // seat_code -> available / held / booked

  var COLOR_SELECTED = '#ffd400';
  var COLOR_SOLD = '#7a8288';

  var seatMeta = {}; // id -> {section, row, seatNum, el, fill}

allSeats.forEach(function(el){
  var id = el.id;

  var m = id.match(/^([UL]B\d+)\s([A-Z]+)(\d+)$/);

  var section = m ? m[1] : id;
  var row = m ? m[2] : '';
  var num = m ? m[3] : '';

  seatMeta[id] = {
    section: section,
    row: row,
    num: num,
    el: el,
    fill: el.getAttribute('fill') || '#5b93ea'
  };
});

// ======================================================
// FIXED 5-MINUTE LOGIN SESSION COUNTDOWN
// ======================================================

function updateSessionCountdown() {

    const countdownElement =
        document.getElementById('sessionCountdown');

    if (!countdownElement) {
        return;
    }

    const expiresAt =
        Number(window.SESSION_EXPIRES_AT);

    const remaining =
        Math.max(
            0,
            expiresAt - Date.now()
        );

    const totalSeconds =
        Math.floor(remaining / 1000);

    const minutes =
        Math.floor(totalSeconds / 60);

    const seconds =
        totalSeconds % 60;

    countdownElement.textContent =
        String(minutes).padStart(2, '0') +
        ':' +
        String(seconds).padStart(2, '0');


    if (totalSeconds <= 0) {

        countdownElement.textContent = '00:00';

        window.location.href =
            'dev_logout.php';

        return;
    }

    setTimeout(
        updateSessionCountdown,
        250
    );
}

updateSessionCountdown();

  function seatLabel(id){
    var m = seatMeta[id];
    if (!m) return id;
    var kind = m.section.charAt(0) === 'U' ? 'Upperbox' : 'Lowerbox';
    return kind + ' ' + m.section.replace(/^UB|^LB/,'') + ' · Row ' + m.row + ' · Seat ' + m.num;
  }
  function seatShortCode(id){
    return id;
  }

  // ---------- state ----------
  var bookedSeats = {}; // database-confirmed booked seats
var heldSeats = {};   // database-held seats
var selectedSeats = []; // this user's current selection

function isBooked(id){
  return seatStatus[id] === 'booked';
}

function isHeld(id){
  return seatStatus[id] === 'held';
}

function isUnavailable(id){
  return isBooked(id) || isHeld(id);
}

function isSelected(id){
  return selectedSeats.indexOf(id) !== -1;
}

  function applySeatVisual(id){
  var m = seatMeta[id];
  if (!m) return;

  var el = m.el;

  var status = seatStatus[id] || 'available';
  var selected = isSelected(id);

  // Remove old state classes
  el.classList.remove('is-sold');
  el.classList.remove('is-held');
  el.classList.remove('is-selected');

  if (status === 'booked'){
    el.classList.add('is-sold');
    el.style.fill = COLOR_SOLD;

  } else if (status === 'held'){
    el.classList.add('is-held');
    el.style.fill = COLOR_SOLD;

  } else if (selected){
    el.classList.add('is-selected');
    el.style.fill = COLOR_SELECTED;

  } else {
    el.style.fill = m.fill;
  }
}
  function refreshAllVisuals(){
    Object.keys(seatMeta).forEach(applySeatVisual);
  }
 
 // ---------- database seat status ----------
async function loadSeatsFromDatabase(){

  var note = document.getElementById('loadingNote');

  try {

    if (note){
      note.textContent = 'Loading seat availability…';
    }

    var response = await fetch('api/get_seats.php', {
      method: 'GET',
      cache: 'no-store'
    });

    if (!response.ok){
      throw new Error('HTTP ' + response.status);
    }

    var data = await response.json();

    if (!data.success){
      throw new Error(data.message || 'Unable to load seats.');
    }

    // Clear current database status
    seatStatus = {};
    bookedSeats = {};
    heldSeats = {};

    data.seats.forEach(function(seat){

      var id = seat.seat_code;

      seatStatus[id] = seat.seat_status;

      if (seat.seat_status === 'booked'){
        bookedSeats[id] = true;
      }

      if (seat.seat_status === 'held'){
        heldSeats[id] = true;
      }
    });

    refreshAllVisuals();

    console.log(
      'Database seats loaded:',
      data.total_seats
    );

  } catch (error){

    console.error(
      'Failed to load seat availability:',
      error
    );

    showToast(
      'Unable to load seat availability.'
    );

  } finally {

    if (note){
      note.textContent = '';
    }
  }
}
  // ---------- toast ----------
  var toastTimer = null;
  function showToast(msg){
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function(){ toastEl.classList.remove('show'); }, 2200);
  }

  // ---------- selection logic ----------
function toggleSeat(id){

  if (isBooked(id)){
    showToast('That seat is already booked.');
    return;
  }

  if (isHeld(id)){
    showToast('That seat is temporarily unavailable.');
    return;
  }

  if (isSelected(id)){

    selectedSeats = selectedSeats.filter(function(s){
      return s !== id;
    });

  } else {

    if (selectedSeats.length >= MAX_SEATS){

      showToast(
        'You can only select up to ' +
        MAX_SEATS +
        ' seats.'
      );

      return;
    }

    selectedSeats.push(id);
  }

  applySeatVisual(id);
  renderPanel();
}

  function removeSeat(id){
    selectedSeats = selectedSeats.filter(function(s){ return s !== id; });
    applySeatVisual(id);
    renderPanel();
  }

  function clearSelection(){
    var prev = selectedSeats.slice();
    selectedSeats = [];
    prev.forEach(applySeatVisual);
    renderPanel();
  }

  // ---------- panel rendering ----------
  var seatListEl = document.getElementById('seatList');
  var emptyStateEl = document.getElementById('emptyState');
  var counterTextEl = document.getElementById('counterText');
  var counterDotsEl = document.getElementById('counterDots');
  var confirmBtn = document.getElementById('confirmBtn');
  var clearBtn = document.getElementById('clearBtn');

  function renderPanel(){
    counterTextEl.textContent = selectedSeats.length + ' / ' + MAX_SEATS + ' selected';
    counterDotsEl.innerHTML = '';
    for (var i=0;i<MAX_SEATS;i++){
      var d = document.createElement('span');
      d.className = 'counter-dot' + (i < selectedSeats.length ? ' filled' : '');
      counterDotsEl.appendChild(d);
    }

    seatListEl.innerHTML = '';
    if (selectedSeats.length === 0){
      emptyStateEl.style.display = 'block';
    } else {
      emptyStateEl.style.display = 'none';
      selectedSeats.forEach(function(id){
        var row = document.createElement('div');
        row.className = 'seat-row';
        var m = seatMeta[id];
        var kind = m.section.charAt(0) === 'U' ? 'Upperbox' : 'Lowerbox';
        row.innerHTML =
          '<div class="seat-row-info">' +
            '<span class="seat-row-code mono">' + id + '</span>' +
            '<span class="seat-row-sub">' + kind + ' ' + m.section.replace(/^UB|^LB/,'') + ' &middot; Row ' + m.row + '</span>' +
          '</div>' +
          '<button class="seat-remove" data-id="' + id + '" title="Remove">&times;</button>';
        seatListEl.appendChild(row);
      });
      Array.prototype.slice.call(seatListEl.querySelectorAll('.seat-remove')).forEach(function(btn){
        btn.addEventListener('click', function(){ removeSeat(btn.getAttribute('data-id')); });
      });
    }

    confirmBtn.disabled = selectedSeats.length === 0;
    clearBtn.disabled = selectedSeats.length === 0;
  }

  document.getElementById('clearBtn').addEventListener('click', clearSelection);

  // ---------- confirm booking ----------
  var confirmedListEl = document.getElementById('confirmedList');
  var confirmCodeEl = document.getElementById('confirmCode');
  var barcodeEl = document.getElementById('barcode');

  function makeConfirmationCode(){
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    var out = '';
    for (var i=0;i<7;i++){ out += chars[Math.floor(Math.random()*chars.length)]; }
    return 'CA-' + out;
  }

  function buildBarcode(){
    barcodeEl.innerHTML = '';
    for (var i=0;i<46;i++){
      var bar = document.createElement('span');
      var h = 14 + Math.floor(Math.random()*24);
      bar.style.height = h + 'px';
      bar.style.opacity = (Math.random() > 0.15) ? '1' : '.35';
      barcodeEl.appendChild(bar);
    }
  }

  function showBookingForm(){
    document.getElementById('bookingForm').style.display = 'block';
    document.getElementById('confirmView').classList.remove('active');
    document.getElementById('footerBooking').style.display = 'block';
    document.getElementById('footerConfirmed').style.display = 'none';
  }
  function showConfirmView(){
    document.getElementById('bookingForm').style.display = 'none';
    document.getElementById('confirmView').classList.add('active');
    document.getElementById('footerBooking').style.display = 'none';
    document.getElementById('footerConfirmed').style.display = 'block';
  }

confirmBtn.addEventListener('click', function(){

  if (selectedSeats.length === 0){
    return;
  }

  showToast(
    'Database booking will be enabled in the next step.'
  );

});

  document.getElementById('newBookingBtn').addEventListener('click', function(){
    showBookingForm();
    renderPanel();
  });
  

  // ---------- seat hover / click (event delegation on the svg) ----------
  var hoveredEl = null;

  function seatElFromEvent(e){
    var t = e.target;
    if (t && t.classList && t.classList.contains('seat')) return t;
    return null;
  }

  svgEl.addEventListener('mousemove', function(e){
    var el = seatElFromEvent(e);
    if (!el){
      if (hoveredEl){ hoveredEl.classList.remove('is-hover'); hoveredEl = null; }
      tooltip.classList.remove('show');
      return;
    }
    if (!isUnavailable(el.id)){
      if (hoveredEl){ hoveredEl.classList.remove('is-hover'); hoveredEl = null; }
      hoveredEl = el;
      hoveredEl.classList.add('is-hover');
    }

    var status;

    if (isBooked(el.id)){
      status = 'Booked';
    } else if (isHeld(el.id)){
      status = 'Temporarily unavailable';
    } else if (isSelected(el.id)){
      status = 'Selected';
    } else {
      status = 'Available';
    }

    ttCode.textContent = seatShortCode(el.id);

    ttStatus.textContent =
      seatLabel(el.id).split('·')[0].trim() === el.id
        ? status
        : (seatLabel(el.id) + ' — ' + status);
    tooltip.style.left = e.clientX + 'px';
    tooltip.style.top = (e.clientY - 14) + 'px';
    tooltip.classList.add('show');
  });

  svgEl.addEventListener('mouseleave', function(){
    if (hoveredEl){ hoveredEl.classList.remove('is-hover'); hoveredEl = null; }
    tooltip.classList.remove('show');
  });

  svgEl.addEventListener('click', function(e){
    var el = seatElFromEvent(e);
    if (!el) return;
    toggleSeat(el.id);
  });

  // ---------- pan & zoom ----------
  var scale = 1, minScale = 0.18, maxScale = 3.2;
  var tx = 0, ty = 0;
  var dragging = false, dragStartX=0, dragStartY=0, txStart=0, tyStart=0;
  var didDrag = false;

  function applyTransform(){
    stage.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + scale + ')';
  }

  function fitToView(){
    var vw = viewport.clientWidth, vh = viewport.clientHeight;
    var sw = 4222, sh = 3263;
    var s = Math.min(vw/sw, vh/sh) * 0.96;
    scale = s;
    tx = (vw - sw*s)/2;
    ty = (vh - sh*s)/2 - vh*0.02;
    applyTransform();
  }

  function zoomAt(factor, clientX, clientY){
    var rect = viewport.getBoundingClientRect();
    var px = clientX - rect.left, py = clientY - rect.top;
    var newScale = Math.min(maxScale, Math.max(minScale, scale * factor));
    var ratio = newScale / scale;
    tx = px - (px - tx) * ratio;
    ty = py - (py - ty) * ratio;
    scale = newScale;
    applyTransform();
  }

  viewport.addEventListener('wheel', function(e){
    e.preventDefault();
    var factor = e.deltaY < 0 ? 1.12 : 1/1.12;
    zoomAt(factor, e.clientX, e.clientY);
  }, { passive:false });

  viewport.addEventListener('mousedown', function(e){
    dragging = true;
    didDrag = false;
    dragStartX = e.clientX; dragStartY = e.clientY;
    txStart = tx; tyStart = ty;
    viewport.classList.add('grabbing');
  });
  window.addEventListener('mousemove', function(e){
    if (!dragging) return;
    var dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
    tx = txStart + dx; ty = tyStart + dy;
    applyTransform();
  });
  window.addEventListener('mouseup', function(){
    dragging = false;
    viewport.classList.remove('grabbing');
  });

  // prevent click-selecting a seat right after a drag
  svgEl.addEventListener('click', function(e){
    if (didDrag){ e.stopPropagation(); didDrag = false; }
  }, true);

  document.getElementById('zoomIn').addEventListener('click', function(){
    var r = viewport.getBoundingClientRect();
    zoomAt(1.25, r.left + r.width/2, r.top + r.height/2);
  });
  document.getElementById('zoomOut').addEventListener('click', function(){
    var r = viewport.getBoundingClientRect();
    zoomAt(1/1.25, r.left + r.width/2, r.top + r.height/2);
  });
  document.getElementById('zoomReset').addEventListener('click', fitToView);

  // touch support (basic pan + tap)
  var touchStartDist = null, touchStartScale = 1;
  viewport.addEventListener('touchstart', function(e){
    if (e.touches.length === 1){
      dragging = true; didDrag = false;
      dragStartX = e.touches[0].clientX; dragStartY = e.touches[0].clientY;
      txStart = tx; tyStart = ty;
    } else if (e.touches.length === 2){
      dragging = false;
      var dx = e.touches[0].clientX - e.touches[1].clientX;
      var dy = e.touches[0].clientY - e.touches[1].clientY;
      touchStartDist = Math.sqrt(dx*dx+dy*dy);
      touchStartScale = scale;
    }
  }, {passive:true});
  viewport.addEventListener('touchmove', function(e){
    if (e.touches.length === 1 && dragging){
      var dx = e.touches[0].clientX - dragStartX, dy = e.touches[0].clientY - dragStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) didDrag = true;
      tx = txStart + dx; ty = tyStart + dy;
      applyTransform();
    } else if (e.touches.length === 2 && touchStartDist){
      var ddx = e.touches[0].clientX - e.touches[1].clientX;
      var ddy = e.touches[0].clientY - e.touches[1].clientY;
      var dist = Math.sqrt(ddx*ddx+ddy*ddy);
      var factor = (dist/touchStartDist) * touchStartScale / scale;
      var cx = (e.touches[0].clientX + e.touches[1].clientX)/2;
      var cy = (e.touches[0].clientY + e.touches[1].clientY)/2;
      zoomAt(factor, cx, cy);
    }
  }, {passive:true});
  viewport.addEventListener('touchend', function(e){
    dragging = false; touchStartDist = null;
  });

  window.addEventListener('resize', fitToView);

// ---------- init ----------
fitToView();
renderPanel();
loadSeatsFromDatabase();

})();
