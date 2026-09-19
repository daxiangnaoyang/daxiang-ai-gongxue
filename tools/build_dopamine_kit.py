import math
import os

import bpy
from mathutils import Vector


OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "assets", "models", "dopamine-kit.glb"))


def material(name, color, roughness=0.56):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1.0)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = (*color, 1.0)
    bsdf.inputs["Roughness"].default_value = roughness
    bsdf.inputs["Specular IOR Level"].default_value = 0.28
    return mat


def finish(obj, mat, bevel=0.0):
    if mat:
        obj.data.materials.append(mat)
    if bevel:
        modifier = obj.modifiers.new("soft hand-drawn edge", "BEVEL")
        modifier.width = bevel
        modifier.segments = 3
        modifier.limit_method = "ANGLE"
        bpy.context.view_layer.objects.active = obj
        bpy.ops.object.modifier_apply(modifier=modifier.name)
    return obj


def rounded_cube(name, location, scale, mat):
    bpy.ops.mesh.primitive_cube_add(location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, min(scale) * 0.24)


def star(name, location, outer_radius, inner_radius, depth, mat):
    points = []
    for index in range(10):
        angle = math.pi / 2 + index * math.pi / 5
        radius = outer_radius if index % 2 == 0 else inner_radius
        points.append((math.cos(angle) * radius, math.sin(angle) * radius))
    vertices = [(x, y, -depth / 2) for x, y in points] + [(x, y, depth / 2) for x, y in points]
    faces = [tuple(range(9, -1, -1)), tuple(range(10, 20))]
    for index in range(10):
        nxt = (index + 1) % 10
        faces.append((index, nxt, 10 + nxt, 10 + index))
    mesh = bpy.data.meshes.new(name + " mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    return finish(obj, mat, depth * 0.18)


def ico(name, location, radius, mat, scale=(1.0, 1.0, 1.0)):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=2, radius=radius, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    return finish(obj, mat)


def torus(name, location, major, minor, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major,
        minor_radius=minor,
        major_segments=32,
        minor_segments=10,
        location=location,
        rotation=rotation,
    )
    return finish(bpy.context.object, mat)


def arrow_piece(name, location, length, mat, rotation=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.14, radius2=0.0, depth=0.42, location=location, rotation=rotation)
    head = finish(bpy.context.object, mat, 0.03)
    head.name = name + " head"
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.07, depth=length, location=(location[0], location[1] - length * 0.5, location[2]), rotation=rotation)
    shaft = finish(bpy.context.object, mat, 0.025)
    shaft.name = name + " shaft"
    return head, shaft


bpy.ops.wm.read_factory_settings(use_empty=True)
os.makedirs(os.path.dirname(OUT), exist_ok=True)

yellow = material("dopamine yellow", (0.92, 0.71, 0.24))
coral = material("coral pop", (0.88, 0.26, 0.22))
blue = material("powder blue", (0.38, 0.70, 0.82))
mint = material("mint glow", (0.48, 0.82, 0.66))
lavender = material("lavender soft", (0.66, 0.55, 0.76))

# Idea: a rounded tile with a bouncing spark.
rounded_cube("idea tile", (-1.7, 0.0, 0.0), (0.55, 0.55, 0.23), yellow).rotation_euler[2] = math.radians(-9)
ico("idea spark", (-1.7, 0.36, 0.42), 0.23, coral, (1.0, 0.74, 1.0))

# Route: a playful star and a short arrow stem.
star("route star", (0.0, 0.06, 0.04), 0.64, 0.28, 0.24, lavender).rotation_euler[2] = math.radians(12)
rounded_cube("route tile", (0.0, -0.43, -0.04), (0.34, 0.09, 0.09), blue).rotation_euler[2] = math.radians(-10)

# Result: a soft orb wrapped by a mint orbit.
ico("result orb", (1.7, 0.0, 0.1), 0.58, blue, (1.0, 0.92, 1.0))
torus("result orbit", (1.7, 0.0, 0.1), 0.74, 0.07, mint, (math.radians(68), math.radians(-10), math.radians(18)))
star("result glint", (1.95, 0.42, 0.58), 0.18, 0.08, 0.1, yellow)

# Small arrow shapes sit between the three characters when the kit is viewed as a strip.
arrow_piece("route arrow", (-0.83, -0.02, 0.12), 0.36, coral, (math.radians(90), 0, 0))
arrow_piece("result arrow", (0.83, -0.02, 0.12), 0.36, coral, (math.radians(90), 0, 0))

for obj in bpy.context.scene.objects:
    obj.select_set(obj.type == "MESH")

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format="GLB",
    use_selection=True,
    export_apply=True,
)
print("Exported", OUT)
