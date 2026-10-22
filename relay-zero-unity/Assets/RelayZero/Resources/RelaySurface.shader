Shader "RelayZero/Surface" {
 Properties { _Color("Color", Color)=(1,1,1,1) _EmissionColor("Emission",Color)=(0,0,0,1) _Metallic("Metallic",Range(0,1))=0 _Glossiness("Smoothness",Range(0,1))=.2 }
 SubShader { Tags { "RenderType"="Opaque" } LOD 200
 CGPROGRAM
 #pragma surface surf Standard fullforwardshadows addshadow
 #pragma target 3.0
 struct Input { float3 worldPos; }; fixed4 _Color; fixed4 _EmissionColor; half _Metallic; half _Glossiness;
 void surf(Input IN,inout SurfaceOutputStandard o){o.Albedo=_Color.rgb;o.Emission=_EmissionColor.rgb;o.Metallic=_Metallic;o.Smoothness=_Glossiness;o.Alpha=_Color.a;}
 ENDCG
 } Fallback "Diffuse"
}
