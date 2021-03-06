var Path = function(game, options)
{
    var self=this;

    this.options = options;

    this.nextType='Path';
    this.num_to_rescue=0;

    this.num_items_line=2;
    this.width = 2;
    this.height = 2;
    this.id = game.getNewId();
    this.generated_doors = {};
    this.doors = {};
    this.outside_separators = [];
    this.line_callbacks = [];

    this.interraction_items=[];
    this.all_interraction_items=[];

    this.cells=[];
};

Path.prototype = Object.create(Maze.prototype);
Path.prototype.constructor = Path;


Path.prototype.get_start_pos = function()
{
    return this.get_cell_pos_params({x: 0, z:0});
};

Path.prototype.update = function(delta)
{
    this.interraction_items.forEach(function(item)
    {
        item.update(delta);
    });
};

Path.prototype.get_end_pos = function()
{
    return this.get_cell_pos_params(this.level.next_maze);
};

Path.prototype.get_cell_pos_params = function(params)
{
    var coord = this.get_pos({ x: params.x, z: params.z });
    return { x: coord.x + this.options.x , z: coord.z + this.options.z, cellid: 0 };
};



Path.prototype.getCollisionCallbacks = function()
{
    var coll = this.line_callbacks;
    if(!this.next_item && this.has_next_level)
    {
        this.buildNext();
    }
    if(this.has_next_level)
    {
        coll = coll.concat(this.next_item.getOutsideCollisionCallbacks());
        if(this.options.parent)
        {
            coll = coll.concat(this.options.parent.getOutsideCollisionCallbacks());
        }
    }
    this.interraction_items.forEach(function(item)
    {
        if(item.walk_through_callback)
        {
            coll.push(item.container_mesh);
        }
    });
    return coll;
};

Path.prototype.collisionCallbacks = function(perso,collisions)
{
    if(collisions.length===0)
    {
        return;
    }
};

Path.prototype.add_cell = function(params)
{
    var self=this;
    var cell =this.create_cell(params);

    params.walls.forEach(function(wall)
    {
        var meshes=[];
        var collision_meshes=[];
        switch(wall.type+'')
        {
            // Small wall
            case '1':
                meshes.push(new THREE.Mesh( game.assets.smallwall1_geo));
                collision_meshes.push(new THREE.Mesh( game.assets.wall_geo));
                break;
            // Full wall
            case '2':
                meshes.push(new THREE.Mesh( game.assets.wall1_geo));
                collision_meshes.push(new THREE.Mesh( game.assets.wall_geo));
                break;
            // Opened
            case '3':
                meshes.push(new THREE.Mesh( game.assets.door1_geo));
                collision_meshes.push(new THREE.Mesh( game.assets.door_geo));
                break;

            // Door:
            // @TODO
            case '4':
                // Opened wall
                meshes.push(new THREE.Mesh( game.assets.door1_geo));
                collision_meshes.push(new THREE.Mesh( game.assets.door_geo));

                // Collision door
                var door =  {
                    mesh : new THREE.Mesh( game.assets.dooropen1_geo, game.assets.multi_path_wall_material.clone()),
                    collision: new THREE.Mesh( game.assets.dooropen_geo, game.assets.transparent_material)
                };
                self.doors[params.x+'-'+params.z+'-'+wall.i] = door;

                door.mesh.position.x = cell.position.x;
                door.mesh.position.y = cell.position.y;
                door.mesh.position.z = cell.position.z;
                door.collision.position.x = cell.position.x;
                door.collision.position.y = cell.position.y;
                door.collision.position.z = cell.position.z;

                self.set_mesh_orientation(door.mesh, wall.i);
                self.set_mesh_orientation(door.collision, wall.i);
                self.container.add(door.mesh);
                self.container.add(door.collision);

                break;
        }

        meshes.forEach(function(mesh)
        {
            mesh.position.x = cell.position.x;
            mesh.position.y = cell.position.y;
            mesh.position.z = cell.position.z;


            self.set_mesh_orientation(mesh, wall.i);
            if(game.opt.debug_level<1)
            {
                self.walls_geom.merge(mesh.geometry, mesh.matrix);
            }
        });
        collision_meshes.forEach(function(collision_mesh)
        {
            collision_mesh.position.x = cell.position.x;
            collision_mesh.position.y = cell.position.y;
            collision_mesh.position.z = cell.position.z;
            self.set_mesh_orientation(collision_mesh, wall.i);
            self.walls_collision_geom.merge(collision_mesh.geometry, collision_mesh.matrix);
        });

    });
    return cell;
};

Path.prototype.build = function()
{
    var self=this;
    this.level_num = game.level-1;
    this.level = Levels[this.level_num];
    this.has_next_level = this.level_num< Levels.length-1;


    if(!this.level)
    {
        console.error('Next level does not exist.');
        return false;
    }

    switch(this.level.type)
    {
        case 'indoor':
            this.music = game.assets.maze_sound;
            this.ambient = game.assets.cave_sound;
            this.floor_material = game.assets.maze_floor_material;
            this.ambient_light_color =  0xd9cba2;
            this.ambient_light_intensity =  0.10;
            break;

        case 'outside':
            this.music = game.assets.path_sound;
            this.ambient = game.assets.blizzard_sound;
            this.floor_material = game.assets.path_floor_material;
            this.ambient_light_color = 0xffffff;
            this.ambient_light_intensity = 0.10;
            break;
    }

    if(this.options.parent)
    {
        this.level.start_cell= { x: 0 , z: 0, i : this.get_opposide_door(this.options.parent.level.next_maze.i) };
    }

    var connected_end = this.get_coord_next_door(this.level.end_cell.x, this.level.end_cell.z, 4);

    var last_cell = null;

    // Auto add walls on outside cells
    this.level.cells.forEach(function(cell, cell_idx)
    {
        cell.connectedTo=[];

        for(var i=0; i<6; i++)
        {
            var nearcell = self.get_coord_next_door(cell.x, cell.z, i);

            // Check if not already put
            neighbor = self.level.cells.filter(function(item) { return item.x == nearcell[0] && item.z == nearcell[1]; });
            has_neighbor = self.level.cells.filter(function(item) { return item.x == nearcell[0] && item.z == nearcell[1]; }).length>0;
            has_already_wall = cell.walls.filter(function(wall) { return wall.i === i ; }).length>0;

            var is_start=false;


            if(has_neighbor)
            {
                neighbor = neighbor[0];
                var inv_door = self.get_opposide_door(i);

                var wall_closed = cell.walls.filter(function(x) { return x.i == i && (x.type=='2' || x.type=='1'); });
                var neighor_closed = neighbor.walls.filter(function(x) { return x.i == inv_door && (x.type=='2' || x.type=='1'); });

                var is_closed = wall_closed.length>0 || neighor_closed.length>0;
                if(cell.connectedTo.indexOf(neighbor)===-1 && !is_closed)
                {
                    cell.connectedTo.push({neighbor:neighbor, x:  neighbor.x, z: neighbor.z, door: i, idx: self.level.cells.indexOf(neighbor)});
                }
            }
            if(self.options.parent)
            {
                is_start = self.level.start_cell ? (cell.x == self.level.start_cell.x && cell.z == self.level.start_cell.z && i===self.level.start_cell.i) : false;
            }
            var is_end = (
                       cell.x == self.level.end_cell.x && cell.z == self.level.end_cell.z &&
                        nearcell[0]== self.level.next_maze.x && nearcell[1] == self.level.next_maze.z
            );

            if(is_end)
            {
                last_cell = cell;
                self.level.next_maze.i = i;
                self.last_cell = {x: cell.x, z:cell.z, i: i};
                if(self.has_next_level)
                {
                    cell.walls.push({ type: '4', i: i});
                }
                else
                {
                    if(self.level.type=='outside')
                    {
                        cell.walls.push({ type: '1', i: i});
                    }
                    else
                    {
                        cell.walls.push({ type: '2', i: i});
                    }
                }
            }
            else if(!has_neighbor && !has_already_wall && !is_start && !is_end)
            {
                if(self.level.type=='outside')
                {
                    cell.walls.push({ type: '1', i: i});
                }
                else
                {
                    cell.walls.push({ type: '2', i: i});
                }
            }
        }
    });

    this.walls_geom = new THREE.Geometry();
    this.walls_collision_geom = new THREE.Geometry();
    this.floor_geom_refs = {};
    this.floor_geom = new THREE.Geometry();

    this.depth = (Math.sqrt(3)/2) * game.opt.door_size*1.0;
    this.depth2 = (Math.sqrt(3)/2) * game.opt.door_size * Math.sqrt(3)/2 *1.35;
    var self=this;
    var current_x = this.options.x;
    var current_z = this.options.z;

    this.container = new THREE.Object3D();
    this.angle = Math.radians(-30);

    this.level.cells.forEach(function(cell)
    {
        var mesh_cell = self.add_cell(cell);

        detection_container = new THREE.Object3D();
        detection_container.position.y=1;
        detection_container.rotation.x = Math.radians(90);

        if(cell.script)
        {
            var script = create_function_once(cell.script);
            for(var i=0;i<6;i++)
            {
                var params = { x: cell.x, z: cell.z, real_x:cell.x, real_z:cell.z };
                var line = self.create_separation_line(
                    self.generated_doors[cell.x][cell.z],
                    params,
                    i,
                    script
                );
                self.line_callbacks.push(line);
            }
        }
    });

    // Set start and end door/cell
    this.start_i = 4;
    this.start_door=null;
    if(this.level.start_cell)
    {
        this.start_door = this.generated_doors[this.level.start_cell.x][this.level.start_cell.z];
    }

    if(this.level.start_cell)
    {
        // Start doors separation line
        var params = { x: 0, z: 0, real_x:'outside',real_z:'outside'};
        var cell = this.cells[0];
        var line = this.create_separation_line(cell,params, this.level.start_cell.i, game.enterType.bind(game, this));
        this.outside_separators.push(line);
    }

    var last_cells = this.cells.filter(function(x)
    {
        return x.params.x == self.level.end_cell.x && x.params.z == self.level.end_cell.z;
            
    });

    for(var i=0;i<6;i++)
    {
        var params = { x: connected_end[0], z: connected_end[1], real_x:'outside',real_z:'outside'};
        var line = this.create_separation_line(
            last_cells[0],
            params,
            i,
            this.enterEndCell.bind(this)
        );
        this.line_callbacks.push(line);
    }

    rescue_container = new THREE.Object3D();
    rescue_container.position.y=1;
    rescue_container.rotation.x = Math.radians(90);

    var rescue_zone = new THREE.CircleGeometry(game.opt.door_size*1.1, 6, 0, Math.PI*2);
    var rescue_material=  new THREE.MeshPhongMaterial( { color: 0x004400, side: THREE.DoubleSide, visible: true, transparent:true, opacity:0.4 } );
    var rescue_mesh = new THREE.Mesh(rescue_zone, rescue_material);

    rescue_container.add(rescue_mesh);
    last_cells[0].add(rescue_container);

    this.container.position.x = current_x;
    this.container.position.y = 0;
    this.container.position.z = current_z;
    this.container.rotation.x = Math.radians(0);

    this.floor_geom.computeVertexNormals();
    var floor = new THREE.Mesh( this.floor_geom, this.floor_material);
    floor.receiveShadow=true;
    floor.castShadow=true;
    this.container.add(floor);


    // Small walls
    var walls = new THREE.Mesh( this.walls_geom, game.assets.multi_path_wall_material);
    walls.name='walls';
    walls.receiveShadow=true;
    walls.castShadow=true;
    walls.receiveShadow=true;
    this.container.add(walls);


    // Walls collision
    this.walls_collision = new THREE.Mesh(
            this.walls_collision_geom,
            new THREE.MeshPhongMaterial(
                {
                    color:0x555555,
                    wireframe: false,
                    visible:game.opt.debug_level>1,
                    transparent: true,
                    opacity:0.8 
                }
            )
    );

    this.walls_collision.name='walls';
    this.container.add(this.walls_collision);

    this.add_ennemys(this.level.seals,'Seal');
    this.add_ennemys(this.level.bears,'Bear');
    this.add_objects();

    game.scene.add(this.container);

};

Path.prototype.add_ennemys = function(items, type)
{
    var self=this;
    items.forEach(function(ennemy)
    {
        var coord = self.get_cell_pos_params({ x: ennemy.x, z: ennemy.z });

        var view_x = coord.x + Math.cos(Math.radians(ennemy.rotation + 90)) * game.opt.door_size;
        var view_z = coord.z + Math.sin(Math.radians(ennemy.rotation + 90)) * game.opt.door_size;

        var patrols = [];
        patrols.push({
            x: coord.x + (game.opt.door_size * ennemy.left)*2 - (game.opt.door_size),
            y:1,
            z: coord.z + (game.opt.door_size * ennemy.top)*2 - (game.opt.door_size),
            patrol_wait: ennemy.patrol_wait
        });
        ennemy.patrol_positions.forEach(function(patrol)
        {
            var coord_pat = self.get_cell_pos_params({ x: patrol.x, z: patrol.z });
            patrols.push({
                x: coord_pat.x + (game.opt.door_size * patrol.left)*2 - game.opt.door_size,
                y: 1,
                z: coord_pat.z + (game.opt.door_size * patrol.top)*2 - game.opt.door_size,
                patrol_wait: patrol.patrol_wait
            });
        });
        var drops = [];
        ennemy.drops.split(/\s+/).forEach(function(drop)
        {
            if(drop)
            {
                drops.push(
                {
                    type:drop,
                    params:{
                    }
                });
            }
        });
        self.add_interraction_item(type,
        {
            level: game.level,
            x: coord.x + (game.opt.door_size * ennemy.left)*2 - (game.opt.door_size),
            z: coord.z + (game.opt.door_size * ennemy.top)*2 - (game.opt.door_size),
            patrol_positions: patrols,
            view_direction:  { x: view_x, z: view_z } ,
            patrol_loop:ennemy.patrol_loop,
            drops: drops,
            patrol_wait: ennemy.patrol_wait
        });
    });
};

Path.prototype.add_objects = function()
{
    var self=this;

    var objects = [ 'stick','hammer','potion','chest','key','fish','pinga' ];
    objects.forEach(function(type)
    {
        var classtype = type.substr(0,1).toUpperCase()+type.substr(1).toLowerCase()
        if(self.level[type])
        {
            self.level[type].forEach(function(object)
            {
                var coord = self.get_cell_pos_params({ x: object.x, z: object.z });
                if(object.key)
                {
                    classtype = object.key;
                }

                if(object.drops)
                {
                    var drops = [];
                    object.drops.split(/\s+/).forEach(function(drop)
                    {
                        if(drop)
                        {
                            drops.push(
                            {
                                type:drop,
                                params:{
                                }
                            });
                        }
                    });
                }
                var item = self.add_interraction_item(classtype,{
                    level: game.level,
                    mazeid: self.id,
                    type: object.key || type,
                    callback: function() { },
                    rotate: Math.radians(-object.rotation),
                    parameters: object,
                    drops: drops,
                    x: coord.x + (game.opt.door_size * object.left)*2 - (game.opt.door_size),
                    y: 1,
                    z: coord.z + (game.opt.door_size * object.top)*2 - (game.opt.door_size),
                });
            });
        }
    });
};



Path.prototype.play_step = function()
{
    if(this.level.type=='indoor')
    {
        game.assets.step_floor_sound.play();
    }
    else
    {
        game.assets.step_snow_sound.play();
    }
};
Path.prototype.stop_step = function()
{
    if(this.level.type=='indoor')
    {
        game.assets.step_floor_sound.pause();
    }
    else
    {
        game.assets.step_snow_sound.pause();
    }
};

Path.prototype.open_last = function()
{
    if(this.has_next_level)
    {
        this.openDoor(this.last_cell.x, this.last_cell.z, this.last_cell.i);
    }
    else
    {
        game.gui.box(
                game.labels.get('lastlevelwin_title'),
                game.labels.get('lastlevelwin_message'),
                true);
    }
};
Path.prototype.enterEndCell = function()
{
    game.focus_perso.rescue();
};

