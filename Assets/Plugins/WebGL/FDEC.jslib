mergeInto(LibraryManager.library, {
  FDEC_Ready: function () { if (window.FDEC) window.FDEC.ready(); },
  FDEC_Save: function (json) { if (window.FDEC) window.FDEC.save(UTF8ToString(json)); },
  FDEC_Board: function () { if (window.FDEC) window.FDEC.board(); }
});
