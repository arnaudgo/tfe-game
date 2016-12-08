var Fish = function(game, options)
{
    this.default(options);

    this.deleted=false;

    this.is_hoverable=false;
    this.can_walk_through=true;
    this.has_walk_through_callback=true;
    this.is_static_collision=false;

    this.object_material = game.assets.fish_mat;
    this.object_geo = game.assets.fish_geo;
    this.pick_sound = game.assets.fish_pick_sound;
    this.drop_sound = game.assets.fish_drop_sound;

};

Fish.prototype = Object.create(Common.prototype);
Fish.prototype.constructor = Common;

