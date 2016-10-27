(function(){
    var Shading = {
        COLORED: 'colored',
        OPEN: 'open',
        SHADED: 'shaded',
        STRIPED: 'striped'
    };

    var Symbol = {
        CIRCLE: 'circle',
        SQUARE: 'square',
        TRIANGLE: 'triangle',
        DIAMOND: 'diamond'
    };

    var combineValues = function(arr, length) {
        var values = [], sub, next;
        for (var i = 0, arri = arr[i]; i < arr.length; i++) {
            if (length === 1) {
                values.push([arri]);
            } else {
                sub = combineValues(arr.slice(i + 1, arr.length), length - 1);
                for (var s = 0, next = sub[s]; s < sub.length; s++) {
                    next = sub[s];
                    next.unshift(arri);
                    values.push(next);
                }
            }
        }
        return values;
    }

    var combineArrays = function() {
        var reduce = function(a, b) {
            var map = function(x) {
                var concat = function(y) { return x.concat([y]); };
                return _.map(b, concat);
            };
            return _.flatten(_.map(a, map), true);
        };
        return _.reduce(arguments, reduce, [[]]);
    };

    var Game = function(counts, colors, symbols, shadings) {
        this.counts = counts;
        this.colors = colors;
        this.symbols = symbols;
        this.shadings = shadings;
        this.columns = this.counts.length;
        this.deck = this.createDeck();

        this.stackSize = this.getStackSize();
        this.addCards(this.stackSize);

        this.cardSize = this.getCardSize();
        this.shapeSize = this.getShapeSize();
        this.patterns = this.getPatterns();

        this.startTimer();
        this.updateControls();
        this.redraw();

        var redraw = this.redraw.bind(this);
        var handleAddClick = this.handleAddClick.bind(this);
        var handlePauseClick = this.handlePauseClick.bind(this);
        d3.select("#add-card").on("click", handleAddClick.bind(this));
        d3.select("#pause-game").on("click", handlePauseClick.bind(this));
        d3.select(window).on("resize", redraw.bind(this));
    };

    Game.prototype.deckIndex = 0;
    Game.prototype.lastTime = 0;
    Game.prototype.score = 0;
    Game.prototype.selection = [];
    Game.prototype.stack = [];
    Game.prototype.time = 0;

    Game.prototype.addToSelection = function(card) {
        this.selection.push(card);
    };

    Game.prototype.addCards = function(count) {
        var newCards = this.deck.slice(this.deckIndex, this.deckIndex + count);
        this.stack = this.stack.concat(newCards);
        this.deckIndex += count;
    };

    Game.prototype.clearSelection = function(valid) {
        var cards = d3.selectAll(".selected");

        cards.classed("selected", false);

        cards.transition().attr({stroke: valid ? "lightgreen" : "red"});
        cards.transition().delay(1000).attr({stroke: "none"});

        this.selection = [];
    };

    Game.prototype.createDeck = function() {
        var counts = this.counts, colors = this.colors;
        var symbols = this.symbols, shadings = this.shadings;
        var cs = combineArrays(counts, colors, symbols, shadings);
        var create = function(c) { return new Card(c[0], c[1], c[2], c[3]); };
        var cards = cs.map(create);
        return _.shuffle(cards);
    };

    Game.prototype.discardSelection = function() {
        this.stack = this.stack.filter(function(card) {
            var notEqual = function(other) { return !card.isEqual(other); };
            return _.every(this.selection, notEqual);
        }, this);
        this.selection = [];
    };

    Game.prototype.draw = function() {
        var svg = d3.select("#game-cards");
        var svgNode = svg.node();

        this.patterns.forEach(function(pattern) {
            svgNode.appendChild(pattern);
        });

        svg.classed("playing", true);
        svg.selectAll("g").remove();

        this.cardViews = this.stack.map(function(card, index) {
            var cardSize = this.cardSize, columns = this.columns;
            var shapeSize = this.shapeSize;
            return new CardView(card, index, cardSize, columns, shapeSize);
        }, this);

        this.cardViews.forEach(function(cardView) {
            var handleCardClick = _.bind(this.selectCard, this, cardView);
            cardView.getElement().addEventListener('click', handleCardClick);
            svg.append(cardView.getElement.bind(cardView));
        }, this);

        var lastRect = this.cardViews[this.cardViews.length - 1].getRect();
        svgNode.setAttribute("height", lastRect[2][1]);
        svgNode.setAttribute("width", this.cardSize[0] * this.columns);
    };

    Game.prototype.fillStack = function() {
        var deficit = this.stackSize - this.stack.length;
        if (deficit > 0) {
            if (this.deckIndex >= this.deck.length) {
                if (!this.hasASet()) {;
                    this.stopTimer();
                    var score = d3.select("#score");
                    var time = d3.select("#timer");
                    score.text("Final score: " + score.text());
                    time.text("Final time: " + time.text());
                }
            } else {
                this.addCards(deficit);
            }
        }
        this.updateControls();
    };

    Game.prototype.getCardCounts = function(cards) {
        var values = cards.map(function(card) { return card.getValues(); });
        return d3.zip.apply(this, values).map(function(els) {
            return _.countBy(els, _.identity);
        });
    };

    Game.prototype.getCardSize = function() {
        var docEl = document.documentElement;
        var viewWidth = docEl.clientWidth, viewHeight = docEl.clientHeight;
        var rows = Math.ceil(this.stack.length / this.counts.length);
        var xPadding = CardView.CARD_PADDING * (this.columns - 1);
        var yPadding = CardView.CARD_PADDING * (rows - 1);
        var yOffset = Math.pow(rows - 4, 0.9) * 16;
        var width = viewWidth / this.columns - xPadding;
        var height = viewHeight / rows - yPadding + yOffset;
        return [Math.min(240, width), Math.min(width * 0.8, 180, height)];
    };

    Game.prototype.getPatterns = function() {
        return this.colors.map(function(color) {
            var id = ["color", color, "pattern"].join("-");
            var pattern = createSvgElement('pattern').attr({
                "id": id,
                "patternUnits": "userSpaceOnUse",
                "width": 9,
                "height": 9
            });
            pattern.append("path")
                .attr("stroke", color)
                .attr("stroke-width", 4)
                .attr("d", "M0,4 L9,4")
            return pattern.node();
        });
    };

    Game.prototype.getShapeSize = function() {
        var docEl = document.documentElement;
        var viewWidth = docEl.clientWidth, viewHeight = docEl.clientHeight;
        return Math.min(this.cardSize[0] / 4, this.cardSize[1] / 2);
    };

    Game.prototype.getStackSize = function() {
        return this.counts.length * (this.counts.length + 1);
    };

    Game.prototype.getTimeBonus = function() {
        var time = Math.max(0, 100 - this.time + this.lastTime);
        return Math.round(Math.sqrt(time));
    };

    Game.prototype.handleAddClick = function() {
        if (this.hasASet()) {
            this.incrementScore(-5);
        }

        this.addCards(this.columns);
        this.updateControls();
        this.redraw();
    };

    Game.prototype.handlePauseClick = function() {
        if (this.timer) {
            this.stopTimer();
        } else {
            this.startTimer();
        }
    };

    Game.prototype.hasASet = function() {
        var isASet = _.bind(this.isASet, this);
        return combineValues(this.stack, this.columns).some(isASet);
    };

    Game.prototype.incrementScore = function(increment) {
        this.score += increment;
    };

    Game.prototype.isASet = function(cards) {
        return _.every(this.getCardCounts(cards), function(count) {
            var is1 = function(value) { return value == 1; };
            var allDifferent = _.every(_.values(count), is1);
            var allSame = _.values(count).length == 1;
            return allDifferent || allSame;
        });
    };

    Game.prototype.redraw = function() {
        this.shapeSize = this.getShapeSize();
        this.cardSize = this.getCardSize();
        this.draw();
    };

    Game.prototype.removeFromSelection = function(card) {
        this.selection = this.selection.filter(function(otherCard) {
            return !card.isEqual(otherCard);
        });
    };

    Game.prototype.selectCard = function(cardView) {
        var card = cardView.card, selected = cardView.selected;
        this.setCardSelected(card, selected);

        if (this.selection.length == this.columns) {
            var isASet = this.isASet(this.selection);
            var increment = -1;
            if (isASet) {
                this.discardSelection();
                increment = 10 + this.getTimeBonus();
                this.lastTime = this.time;
                this.fillStack();
                setTimeout(this.redraw.bind(this), 800);
            }

            this.incrementScore(increment);
            this.clearSelection(isASet);
            this.updateScore();
        }
    };

    Game.prototype.setCardSelected = function(card, selected) {
        if (selected) {
            this.addToSelection(card);
        } else {
            this.removeFromSelection(card);
        }
    };

    Game.prototype.showSymbols = function(show) {
        d3.selectAll(".symbol").transition().style("opacity", show ? 1 : 0);
    };

    Game.prototype.startTimer = function() {
        this.timer = setInterval(this.tick.bind(this), 1000);
        this.showSymbols(true);
    };

    Game.prototype.stopTimer = function() {
        clearInterval(this.timer);
        this.timer = null;
        this.showSymbols(false);
    };

    Game.prototype.tick = function() {
        var hours = Math.floor(this.time / 3600)
        var minutes = Math.floor(this.time / 60) % 60;
        var seconds = this.time % 60;
        var minuteStr = minutes < 10 ? "0" + minutes : minutes;
        var secondStr = seconds < 10 ? "0" + seconds : seconds;
        var text = [hours, minuteStr, secondStr].join(":");
        d3.select("#timer").text(text);
        this.time += 1;
    };

    Game.prototype.updateControls = function() {
        var remaining = this.deck.length - this.deckIndex + this.stack.length;
        var canAddCards = remaining > this.stack.length;
        d3.select("#cards-remaining").text(remaining + "/" + this.deck.length);
        d3.select("#add-card").classed("enabled", canAddCards);
        this.updateScore();
    };

    Game.prototype.updateScore = function() {
        d3.select("#score").text(this.score + " points");
    };

    var Card = function(count, color, symbol, shading) {
        this.count = count;
        this.color = color;
        this.symbol = symbol;
        this.shading = shading;
    };

    Card.prototype.isEqual = function(other) {
        var sameCount = this.count == other.count;
        var sameColor = this.color == other.color;
        var sameSymbol = this.symbol == other.symbol;
        var sameShading = this.shading == other.shading;
        return sameCount && sameColor && sameSymbol && sameShading;
    };

    Card.prototype.getValues = function() {
        return [this.count, this.color, this.symbol, this.shading];
    };

    var CardView = function(card, index, cardSize, columns, shapeSize) {
        this.card = card;
        this.index = index;
        this.cardSize = cardSize;
        this.columns = columns;
        this.shapeSize = shapeSize - CardView.CARD_PADDING;

        this.shape = CardView.TAG_NAME[this.card.symbol];
        this.el = this.draw();
        this.selected = false;

        d3.select(this.el).on('click', this.select.bind(this));
    };

    CardView.CARD_PADDING = 10;

    CardView.FILL_OPACITY = {};
    CardView.FILL_OPACITY[Shading.OPEN] = 0;
    CardView.FILL_OPACITY[Shading.SHADED] = 0.25;
    CardView.FILL_OPACITY[Shading.COLORED] = 1;
    CardView.FILL_OPACITY[Shading.STRIPED] = 1;

    CardView.TAG_NAME = {};
    CardView.TAG_NAME[Symbol.CIRCLE] = "circle";
    CardView.TAG_NAME[Symbol.SQUARE] = "rect";
    CardView.TAG_NAME[Symbol.TRIANGLE] = "polygon";
    CardView.TAG_NAME[Symbol.DIAMOND] = "polygon";

    CardView.prototype.select = function() {
        this.selected = !this.selected;
        d3.select(this.el).select(".card")
            .classed("selected", this.selected)
            .attr("stroke", this.selected ? "black" : "none");
    };

    CardView.prototype.getElement = function() {
        return this.el;
    };

    CardView.prototype.getRect = function() {
        var position = this.getGridPosition(this.index)
        var x1 = position[0] * this.cardSize[0], x2 = x1 + this.cardSize[0];
        var y1 = position[1] * this.cardSize[1], y2 = y1 + this.cardSize[1];
        return d3.geom.polygon([[x1, y1], [x2, y1], [x2, y2], [x1, y2]]);
    };

    CardView.prototype.getGridPosition = function(index) {
        return [index % this.columns, Math.floor(index / this.columns)];
    };

    CardView.prototype.drawShapes = function() {
        var cx = this.cardSize[0] / 2;
        var cy = this.cardSize[1] / 2;
        var start = (this.card.count - 1) * -0.6;
        var end = (this.card.count + 1) * 0.6;
        var range = d3.range(start, end, 1.2);

        var getCentroid = function(dx) {
            return [cx + this.shapeSize * dx, cy];
        };
        var centroids = range.map(getCentroid, this);
        return centroids.map(this.drawShape, this);
    };

    CardView.prototype.draw = function() {
        var rect = this.getRect();
        var g = createSvgElement("g")

        var attrs = {transform: "translate(" + rect[0] + ")"};
        g.attr(attrs).node().appendChild(this.drawBackground(rect));

        this.drawShapes().forEach(function(shape) {
            g.node().appendChild(shape);
        });
        return g.node();
    };

    CardView.prototype.drawBackground = function(cardRect) {
        var rect = createSvgElement("rect");
        var p = CardView.CARD_PADDING, hp = p / 2;
        var width = this.cardSize[0] - p;
        var height = this.cardSize[1] - p;
        var attrs = {x: hp, y: hp, rx: p, ry: p, width: width, height: height};
        return createSvgElement("rect")
            .attr(attrs).classed("card", true).node();
    };

    CardView.prototype.getFillOpacity = function() {
        return CardView.FILL_OPACITY[this.card.shading];
    };

    CardView.prototype.getShapeRect = function(centroid) {
        var rad = this.shapeSize / 2;
        var l = centroid[0] - rad;
        var b = centroid[1] + rad;
        var r = centroid[0] + rad;
        var t = centroid[1] - rad;
        return {radius: rad, left: l, bottom: b, right: r, top: t};
    };

    CardView.prototype.getShapeAttrs = function(centroid) {
        var color = this.card.color;
        var opacity = this.getFillOpacity();
        var stroke = fill = color;
        if (this.card.shading == Shading.STRIPED) {
            fill = "url(#color-" + color + "-pattern)";
        }
        var attrs = {
            "class": "symbol",
            "fill": fill,
            "fill-opacity": opacity,
            "stroke": stroke
        };
        var rect = this.getShapeRect(centroid);
        if (this.card.symbol == Symbol.CIRCLE) {
            attrs.cx = centroid[0];
            attrs.cy = centroid[1];
            attrs.r = rect.radius;
        }
        if (this.card.symbol == Symbol.SQUARE) {
            attrs.x = rect.left;
            attrs.y = rect.top;
            attrs.height = rect.right - rect.left;
            attrs.width = rect.bottom - rect.top;
        }

        var isTriangle = this.card.symbol == Symbol.TRIANGLE;
        var isDiamond = this.card.symbol == Symbol.DIAMOND;
        if (isTriangle || isDiamond) {
            attrs.points = isTriangle ?
                [
                    [centroid[0], rect.top],
                    [rect.left, rect.bottom],
                    [rect.right, rect.bottom]
                ]
                :
                [
                    [centroid[0], rect.top],
                    [rect.left, centroid[1]],
                    [centroid[0], rect.bottom],
                    [rect.right, centroid[1]]
                ];
        }
        return attrs;
    };

    CardView.prototype.drawShape = function(centroid) {
        var attrs = this.getShapeAttrs(centroid);
        return createSvgElement(this.shape).attr(attrs).node();
    };

    var createSvgElement = function(tagName) {
        var ns = "http://www.w3.org/2000/svg";
        return d3.select(document.createElementNS(ns, tagName));
    };

    var getColors = function(count, opt_angle) {
        var angle = opt_angle || Math.floor(Math.random() * 360);
        var angleIncrement = 360 / count;
        return d3.range(count).map(function(n) {
            return d3.hsl(angle + n * angleIncrement, 0.75, 0.5) + '';
        });
    };

    var App = function() {
        this.startGame();
    };

    App.prototype.showGame = function() {
        d3.select("#game").classed("enabled", true);
    };

    App.prototype.startGame = function() {
        this.showGame();
        var dimensions = 3;
        var counts = d3.range(1, dimensions + 1);
        var symbols = _.shuffle(_.values(Symbol)).slice(0, dimensions);
        var shadings = _.shuffle(_.values(Shading)).slice(0, dimensions);

        var colors = getColors(dimensions);
        this.game = new Game(counts, colors, symbols, shadings);
    };

    window.addEventListener("load", function(e) {
        new App();
    });
})();
