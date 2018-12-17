(function () {
  function Mosaic(element) {
    this.photos = Array.from(element.querySelectorAll('img')).map(function (image) {
      let width = parseInt(image.getAttribute('width'), 10);
      let height = parseInt(image.getAttribute('height'), 10);
      return {
        url: image.getAttribute('src'),
        altText: image.getAttribute('alt'),
        aspectRatio: width / height
      };
    });
    this.idealHeight = 250;
    this.minimumShrink = 150;
    if (this.photos.length < 3) {
      this.minimumShrink = 100;
      this.maximumStretch = 800;
    } else {
      this.maximumStretch = 300;
    }
    this.gutter = 10;
    this.viewportWidth = 0;
    this.element = element;
  }

  Mosaic.prototype = {
    didResize() {
      let width = this.element.clientWidth + this.gutter;
      if (width !== this.viewportWidth) {
        this.viewportWidth = width;
        this.render();
      }
    },

    findPossibleRows(photos) {
      let validRows = [];
      let row = {
        aspectRatio: 0,
        photos: []
      };
      let viewportWidth = this.viewportWidth;
      for (let i = 0, len = photos.length; i < len; i++) {
        let { photo, aspectRatio } = photos[i];
        row.photos.push(photo);
        row.aspectRatio += aspectRatio;
  
        let height = (viewportWidth - (row.photos.length * this.gutter)) / row.aspectRatio;
        if (height > this.maximumStretch && i < len - 1) {
          continue;
        } else if (height < this.minimumShrink) {
          break;
        } else {
          let score = Math.pow(Math.abs(this.idealHeight - height), 2);
          let nextRow = this.findPossibleRows(photos.slice(i + 1));
          height = Math.min(this.maximumStretch, height);
          validRows.push({
            score,
            height,
            photos: row.photos.slice().map((photo) => {
              return {
                photo,
                width: photo.aspectRatio * height
              };
            }),
            nextRow
          });
        }
      }
      return validRows;
    },
  
    getScores(rows, result={ score: 0, rows: [] }, state={ minimum: Infinity }) {
      let results = [];
      for (let i = 0, len = rows.length; i < len; i++) {
        let row = rows[i];
        let path = {
          score: result.score + row.score,
          rows: [...result.rows, row]
        };
  
        // Skip if there's already a better solution
        if (path.score > state.minimum) {
          continue;
        }
  
        if (row.nextRow.length === 0) {
          if (path.score < state.minimum) {
            results.push(path);
            state.minimum = path.score;
          }
        } else {
          results = results.concat(this.getScores(row.nextRow, path, state));
        }
      }
      return results;
    },
  
    render() {
      if (this.photos == null || this.photos.length === 0 || this.viewportWidth <= 0) {
        return [];
      }
  
      let photos = this.photos.map((photo) => {
        return {
          photo,
          aspectRatio: photo.aspectRatio
        };
      });
  
      let rows = this.findPossibleRows(photos);
      let results = this.getScores(rows);
      let result = results[results.length - 1].rows;

      let element = this.element;
      var range = document.createRange();
      range.selectNodeContents(this.element);
      range.deleteContents();

      result.forEach(function (row) {
        let $row = document.createElement('div');
        $row.classList.add('mosaic-row');
        row.photos.forEach(function (cell) {
          let $img = document.createElement('img');
          if (cell.photo.altText) {
            $img.setAttribute('alt', cell.photo.altText)
          }
          $img.setAttribute('src', cell.photo.url);
          $img.setAttribute('width', cell.width);
          $img.setAttribute('height', row.height);
          $row.appendChild($img);
        });
        element.appendChild($row);
      });
    }
  };

  let mosaics = Array.from(document.querySelectorAll('.mosaic')).map(function (element) {
    let mosaic = new Mosaic(element);
    mosaic.didResize();
    return mosaic;
  });

  window.addEventListener('resize', function () {
    requestAnimationFrame(function () {
      mosaics.forEach(function (mosaic) {
        mosaic.didResize();
      });
    });
  });
})();
