var Pleiades = Pleiades ? Pleiades : new Object();

Pleiades.config = new Object();
Pleiades.config.enable_pixel_perfect_collision = true;
Pleiades.config.debug = false;
Pleiades.config.starting_id = 0;

Pleiades.utils = new Object();
Pleiades.utils.array_from_object = function(obj) {
    	var a = new Array(obj.length);
    	for (var i=0; i<obj.length; i++)
      		a[i] = obj[i];
	return a;
}

Pleiades.utils.extend_object = function(dst, src) {
	for (var i in src) {
		try{ dst[i] = src[i] } catch(e) {}
	}
	return dst;
}

Pleiades.utils.conditional_extend_object = function(dst, src) {
	for (var i in src) {
    		if (dst[i] == null)
      			dst[i] = src[i];
  	}
  	return dst;
}

Pleiades.Klass = function() {
	var c = function() {
		this.initialize.apply(this, arguments);
  	};
  	c.ancestors = Pleiades.utils.array_from_object(arguments);
  	c.prototype = {};
  	for(var i = 0; i<arguments.length; i++) {
    		var a = arguments[i];
    		if (a.prototype)
      			Pleiades.utils.extend_object(c.prototype, a.prototype);
    		else
      			Pleiades.utils.extend_object(c.prototype, a);
  	}
  	Pleiades.utils.extend_object(c, c.prototype);
  	return c;
}

Pleiades.MainLoop = Pleiades.Klass({
	initialize : function(fps) {
		this.fps = fps;
		this._priv = new Object();
		this._priv.tick = 1000.0/fps;
		this._priv.time = 0;
		this.canvases = [];
	},
	run : function() {
		var me = this;
		var frame_loop = function() {
			me.step();
		}
		setInterval(frame_loop, this._priv.tick);
	},
	step : function() {
		this._priv.time = new Date().getTime();
		for(var i=0; i<this.canvases.length; ++i) {
			var c = this.canvases[i];
			c.update(this._priv.time);
		}
		for(var i=0; i<this.canvases.length; ++i) {
			var c = this.canvases[i];
			c.draw();
		}
	},
	addCanvas : function(canvas) {
		this.canvases.push(canvas);
	}
});

Pleiades.Canvas = Pleiades.Klass({
	initialize : function(elementid, clear, dbuffer) {
		this.container = document.getElementById(elementid);

		var elistener = document.createElement('div');
		elistener.style.position = 'absolute';
		elistener.style.zIndex = 99;
		elistener.style.width = this.container.clientWidth + 'px';
		elistener.style.height = this.container.clientHeight + 'px';
		this.container.appendChild(elistener);

		var me = this;
		elistener.onclick = function(evt) { me.clicked(evt); };

		this.canvas = document.createElement('canvas');
		this.container.appendChild(this.canvas);
		this.ctx = this.canvas.getContext('2d');
                this.canvas.width = this.container.clientWidth;
		this.canvas.height = this.container.clientHeight;	

		if (!clear)
			clear = true;

		if (dbuffer) {
			this.buffere = document.createElement('canvas');
			this.buffere.width = this.canvas.width;
			this.buffere.height = this.canvas.height;
			this.buffer = this.buffere.getContext('2d');
			this.container.appendChild(this.buffere);
		}

		this.collision_canvas = new Array();
		for (i=0; i<3; ++i) {
			this.collision_canvas[i] = document.createElement('canvas');
			this.collision_canvas[i].width = this.canvas.width;
			this.collision_canvas[i].height = this.canvas.height;
			this.collision_canvas[i].ctx = this.collision_canvas[i].getContext('2d');

			if (Pleiades.config.debug)
				document.body.appendChild(this.collision_canvas[i]);
		}

		this.clear = clear;
                this.scene = [];
		this.last_update = 0;
		this.width = this.canvas.width;
		this.height = this.canvas.height;
	},
	clicked : function(evt) {
		var x = evt.layerX;
		var y = evt.layerY;

		if (x == undefined)
			x = evt.x;
		if (y == undefined)
			y = evy.y;
	
		evt.x = x;
		evt.y = y;

		this.onclick(evt);

		var recursive_click_children = function(child, evt) {
			var child_x = child.getX();
			var child_y = child.getY();

			if ((evt.x > child_x) && (evt.x < (child_x + child.width)) &&
			    (evt.y > child_y) && (evt.y < (child_y + child.height))) {
				if (Pleiades.config.debug)
					console.log('clicked', child.name);

				for(var i=0; i<child.children.length; ++i) {
					var node = child.children[i];
					recursive_click_children(node, evt);
				}
			}
		}

		for(var i=0; i<this.scene.length; ++i)
			recursive_click_children(this.scene[i], evt);

		return true;
	},
	onclick : function(evt) {
	},
	flip : function(time) {
		if (this.buffer) {
			var buffer = this.ctx;
			this.ctx = this.buffer;
			this.buffer = buffer;

			var buffere = this.canvas;
			this.canvas = this.buffere;
			this.buffere = buffere;

			this.canvas.style.display='none';
			this.buffere.style.display='block';
		}
	},
	update : function(time) {
		this.last_update = time;
		for(var i=0; i<this.scene.length; ++i) {
			var n = this.scene[i];
			n.update(time);
		}
	},
	draw : function() {
		if (this.clear)
			this.ctx.clearRect(0,0, this.canvas.width, this.canvas.height);

		for(var i=0; i<this.scene.length; ++i) {
			var n = this.scene[i];
			n.draw(this);
		}
		
		this.flip();
	},
	addNode : function(node) {
		node.parent = this;
		node.canvas = this;
		this.scene.push(node);
	},
	findNode : function(nodename) {
		var recursive_find_children = function(where, nodename) {
			for(var i=0; i<where.length; ++i) {
				var node = where[i];
				if (node.name == nodename)
					return {'idx':i, 'entry':node};
				else
					return recursive_find_children(node.children, nodename);
			}
			return null;
		}
		return recursive_find_children(this.scene, nodename);
	},
	delNode : function(nodename) {
		var node_data = this.findNode(nodename);
		if (!node_data)
			return;

		var node = node_data.entry;
		var index = node_data.idx;
		if (node.parent == this)
			this.scene = this.scene.splice(index, 1);
		else
			node.parent.children = node.parent.children.splice(index, 1);
	}
});

Pleiades.Action = Pleiades.Klass({
	initialize : function(tick_time, data, onperform) {
		this.tick_time = tick_time;
		this.data = data;
		this.next_tick = 0;
		this.last_tick = 0;

		this.onperform = onperform;
	},
	perform : function(name, obj, time) {
		this.next_tick = time + this.tick_time;
		this.owner = obj;
		this.name = name;
		Pleiades.utils.conditional_extend_object(this.owner.data, this.data);
		this.onperform(time);
		this.owner = null;
		this.name = null;
		this.last_tick = time;
	},
	clone : function(tick_time, data) {
		var new_data = Pleiades.utils.extend_object({}, this.data);
		new_data = Pleiades.utils.extend_object(new_data, data);
		return new Pleiades.Action(tick_time, new_data, this.onperform);
	}
});

Pleiades.Trigger = Pleiades.Klass({
	initialize : function(data, oncheck, onperform, onoff) {
		this.data = data;

		this.oncheck = oncheck;
		this.onperform = onperform;
		this.onoff = onoff;
		this.statuses = new Object();
	},
	check : function(name, obj, time) {
		this.owner = obj;
		this.name = name;
		Pleiades.utils.conditional_extend_object(this.owner.data, this.data);
		var result = this.oncheck(time);
		return result;		
	},
	wentoff : function(name, obj, time) {
		if (this.statuses[obj.name]) {
			this.statuses[obj.name] = false;
			return true;
		}
		return false;
	},
	perform : function(name, obj, time) {
		this.statuses[obj.name] = true;
		this.onperform(time);
		this.owner = null;
		this.name = null;
	},
	turnoff : function(name, obj, time) {
		if (this.onoff)
			this.onoff(time);
		this.owner = null;
		this.name = null;
	}
});

Pleiades.actions = new Object();
Pleiades.actions.moveto = new Pleiades.Action(50, {'destination': [null, null],
                                                        'speed' : 1}, 
  function(time) {
    if (this.owner.data.destination[0] != null) {
      var speed_x = Math.min(Math.abs(this.owner.data.destination[0] - this.owner.x), this.owner.data.speed);
      if (this.owner.x < this.owner.data.destination[0])
	this.owner.x += speed_x;
      else if (this.owner.x > this.owner.data.destination[0])
	this.owner.x -= speed_x;
    }

    if (this.owner.data.destination[1] != null) {
      var speed_y = Math.min(Math.abs(this.owner.data.destination[1] - this.owner.y), this.owner.data.speed);
      if (this.owner.y < this.owner.data.destination[1])
	this.owner.y += speed_y;
      else if (this.owner.y > this.owner.data.destination[1])
	this.owner.y -= speed_y;
    }
});

Pleiades.Node = Pleiades.Klass({
	initialize : function(x, y, w, h, name) {
		this._priv = new Object();
		if(!name) {
			++Pleiades.config.starting_id;
			name = 'node' + Pleiades.config.starting_id;
		}
		
		this.name = name;
		this.x = x;
		this.y = y;
		this.width = w ? w : 0;
		this.height = h ? h : 0;
		this.children = [];
		this.actions = new Object();
		this.triggers = new Object();
		this.data = new Object();
	},
	addAction : function(name, a) {
		this.actions[name] = [a, true];
	},
	delAction : function(name) {
		delete this.actions[name];
	},
	enableAction : function(name) {
		this.triggers[name][1] = true;
	},
	disableAction : function(name) {
		this.triggers[name][1] = false;
	},
	addTrigger : function(name, t) {
		this.triggers[name] = [t, true];
	},
	delTrigger : function(name) {
		delete this.triggers[name];
	},
	enableTrigger : function(name) {
		this.triggers[name][1] = true;
	},
	disableTrigger : function(name) {
		this.triggers[name][1] = false;
	},
	onchildx : function(child) { return this.x + child.x; },
	onchildy : function(child) { return this.y + child.y; },
	getX : function() {
		return this.parent != this.canvas ? this.parent.onchildx(this) : this.x;
	},
	getY : function() {
		return this.parent != this.canvas ? this.parent.onchildy(this) : this.y;
	},
	collides : function(other, t) {
		if (t == null)
			t = 0;

		var tx = this.getX();
		var ty = this.getY();
		var tw = this.width;
		var th = this.height;

		var ox = other.getX();
		var oy = other.getY();
		var ow = other.width;
		var oh = other.height;

		if (this.scale || other.scale)
			var first_check = true;
		else
			var first_check = !((tx+th-1-t<oy+t) || (ty+t> oy+oh-1-t) || (tx+tw-1-t<ox+t) || (tx+t>ox+ow-1-t));

		if (first_check && Pleiades.config.enable_pixel_perfect_collision)
			return this.checkPixelCollision(other);
		else
			return first_check;
	},
	checkPixelCollision : function(other) {
		var test_canvas = this.canvas.collision_canvas;
		
		var small_canvas = document.createElement('canvas');
		small_canvas.width = 16;
		small_canvas.height = 16;

		var obj1_comp = this._priv.composite_operation;
		var obj2_comp = other._priv.composite_operation;
		var obj1_stroke = this._priv.stroke_style;
		var obj2_stroke = other._priv.stroke_style;
		var obj1_fill = this._priv.fill_style;
		var obj2_fill = other._priv.fill_style;
		var obj1_children = this.children;
		var obj2_children = other.children;

		this.setComposition(null);
		other.setComposition(null);

		test_canvas[0].ctx.clearRect(0, 0, test_canvas[0].width, test_canvas[0].height);
		this.draw(test_canvas[0]);

		test_canvas[1].ctx.clearRect(0, 0, test_canvas[1].width, test_canvas[1].height);
		other.draw(test_canvas[1]);

		test_canvas[2].ctx.clearRect(0, 0, test_canvas[2].width, test_canvas[2].height);
		test_canvas[2].ctx.globalCompositeOperation = 'source-over';
		test_canvas[2].ctx.drawImage(test_canvas[0], 0, 0, test_canvas[0].width, test_canvas[0].height);
		test_canvas[2].ctx.globalCompositeOperation = 'source-in';
		test_canvas[2].ctx.drawImage(test_canvas[1], 0, 0, test_canvas[1].width, test_canvas[1].height);
		
		small_canvas.ctx = small_canvas.getContext('2d');
		small_canvas.ctx.drawImage(test_canvas[2], 0, 0, test_canvas[2].width, test_canvas[2].height, 0, 0, small_canvas.width, small_canvas.height);
		var collision = small_canvas.ctx.getImageData(0, 0, small_canvas.width, small_canvas.height).data;
		collision = Pleiades.utils.array_from_object(collision).sort(function(a, b){return b - a;})[0];

		this.setComposition(obj1_comp);
		other.setComposition(obj2_comp);

		return collision;
	},
	addNode : function(child) {
		if (child.parent)
			child.canvas.delNode(child.name);
		child.canvas = this.canvas;
		child.parent = this;
		this.children.push(child);
		return this;
	},
	update : function(time) {
		for(var i in this.triggers) {
			var t = this.triggers[i];
			var state = t[1];
			if (!state)
				continue;

			t = t[0];
			if (t.check(i, this, time))
				t.perform(i, this, time);
			else if (t.wentoff(i, this, time))
				t.turnoff(i, this, time);
		}

		for(var i in this.actions) {
			var a = this.actions[i];
			var state = a[1];
			if (!state)
				continue;

			a = a[0];
			if ((!a.tick_time) || (time >= a.next_tick))
				a.perform(i, this, time);
		}

		for(var i=0; i<this.children.length; ++i) {
			var n = this.children[i];
			n.update(time);
		}
	},
	draw : function(canvas) {
		if (this.ondraw) {
			canvas.ctx.save();
			var center_x = this.x+this.width/2;
			var center_y = this.y+this.height/2;

			if (this._priv.scale) {
				canvas.ctx.translate(center_x, center_y);
				canvas.ctx.scale(this._priv.scale[0], this._priv.scale[1]);
				canvas.ctx.translate(-center_x, -center_y);
			}

			if (this._priv.degree) {
				canvas.ctx.translate(center_x, center_y);
				canvas.ctx.rotate(this._priv.degree * Math.PI / 180);
				canvas.ctx.translate(-center_x, -center_y);
			}

			if (this._priv.opacity != null)
				canvas.ctx.globalAlpha = this._priv.opacity;

			if (this._priv.composite_operation)
				canvas.ctx.globalCompositeOperation = this._priv.composite_operation;

			if (this._priv.stroke_style)
				canvas.ctx.strokeStyle = this._priv.stroke_style;

			if (this._priv.fill_style)
				canvas.ctx.fillStyle = this._priv.fill_style;

			this.ondraw(canvas);

			if (this._priv.fill_style)
				canvas.ctx.fill();

			if (this._priv.stroke_style)
				canvas.ctx.stroke();

			canvas.ctx.restore();
		}

		for(var i=0; i<this.children.length; ++i) {
			var n = this.children[i];
			n.draw(canvas);
		}
	},
	scale : function(x, y) {
		if (x == null && y == null)
			this._priv.scale = null;
		else
			this._priv.scale = [x, y];
		return this;
	},
	rotate : function(degree) {
		this._priv.degree = degree;
		return this;
	},
	setOpacity : function(opacity) {
		this._priv.opacity = opacity;
		return this;
	},
	setComposition : function(composite_operation) {
		this._priv.composite_operation = composite_operation;
		return this;
	},
	setStroke : function(stroke_style) {
		this._priv.stroke_style = stroke_style;
		return this;
	},
	setFill : function(fill_style) {
		this._priv.fill_style = fill_style;
		return this;
	}
});

Pleiades.Rectangle = Pleiades.Klass(Pleiades.Node, {
	initialize : function(x, y, w, h, name) {
		Pleiades.Node.initialize.call(this, x, y, w, h, name);
		if (!name)
			this.name = 'rect' + this.name;

		this.setStroke('black');
		this.setFill(null);
	},
	ondraw : function(canvas) {
		canvas.ctx.beginPath();
		canvas.ctx.rect(this.getX(), this.getY(), this.width, this.height);
		canvas.ctx.closePath();
	}
});

Pleiades.Spiral = Pleiades.Klass(Pleiades.Node, {
	initialize : function(x, y, angle, name) {
		Pleiades.Node.initialize.call(this, x, y, 0, 0, name);
		if (!name)
			this.name = 'spiral' + this.name;

		this.angle = angle;
		this.setStroke('black');
		this.setFill(null);
	},
	ondraw : function(canvas) {
		var x = this.getX();
		var y = this.getY();
		var ctx = canvas.ctx;

		ctx.beginPath();		
    		ctx.moveTo(x, y);
      		var a = 0.1;
      		while (a < this.angle) {
        		ctx.lineTo(x+Math.cos(a)*a, y-Math.sin(a)*a);
        		a += 0.1;
      		}
   		a = this.angle;
    		ctx.lineTo(x+Math.cos(a)*a, y-Math.sin(a)*a);
	}
});

Pleiades.Image = Pleiades.Klass(Pleiades.Node, {
	initialize : function(x, y, w, h, image, crop, name) {
		Pleiades.Node.initialize.call(this, x, y, w == null ? image.width : w, h == null ? image.height : h, name);
		if (!name)
			this.name = 'img' + this.name;

		this.image = image;
		
		this.crop = crop;
		if (crop) {
			this.crop_x = crop[0];
			this.crop_y = crop[1];
			this.crop_w = crop[2];
			this.crop_h = crop[3];
		}
	},
	ondraw : function(canvas) {
		var ctx = canvas.ctx;
		if (this.crop == null)
			ctx.drawImage(this.image, this.getX(), this.getY(), this.width, this.height);
		else
			ctx.drawImage(this.image, this.crop_x, this.crop_y, this.crop_w, this.crop_h,
						  this.getX(), this.getY(), this.width, this.height);
	}
});
Pleiades.Image.Load = function(src) {
	var img = new Image();
	img.src = src;
	return img;
}
