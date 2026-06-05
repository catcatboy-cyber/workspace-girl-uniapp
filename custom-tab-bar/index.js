Component({
  data: {
    hidden: false,
    selected: 0,
    list: [
      { pagePath: 'pages/index/index', text: '今日' },
      { pagePath: 'pages/case-detail/case-detail', text: '我们' },
      { pagePath: 'pages/cases/cases', text: 'Crushes' },
      { pagePath: 'pages/timeline/timeline', text: '往事' },
      { pagePath: 'pages/me/me', text: '我' }
    ],
    sideItems: [
      { pagePath: 'pages/index/index', text: '今日' },
      { pagePath: 'pages/case-detail/case-detail', text: '我们' },
      { pagePath: 'pages/timeline/timeline', text: '往事' },
      { pagePath: 'pages/me/me', text: '我' }
    ]
  },
  methods: {
    switchTab(e) {
      var idx = e.currentTarget.dataset.idx
      var item = this.data.list[idx]
      if (item && idx !== this.data.selected) {
        console.log('[TABBAR] switchTab:', this.data.selected, '->', idx, item.pagePath, new Date().toISOString())
        wx.switchTab({ url: '/' + item.pagePath })
      }
    },
    onCrushTap() {
      if (this.data.selected !== 2) {
        wx.switchTab({ url: '/pages/cases/cases' })
      }
    },
    updateSelected() {
      var pages = getCurrentPages()
      var current = pages[pages.length - 1]
      if (current) {
        var route = current.route || ''
        for (var i = 0; i < this.data.list.length; i++) {
          if (this.data.list[i].pagePath === route) {
            if (this.data.selected !== i) {
              this.setData({ selected: i })
            }
            return
          }
        }
      }
    },
    setHidden(hidden) {
      if (this.data.hidden !== !!hidden) {
        this.setData({ hidden: !!hidden })
      }
    }
  }
})
