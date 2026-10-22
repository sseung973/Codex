Shader "RelayZero/WorldText"
{
    Properties { _MainTex("Font atlas", 2D) = "white" {} }
    SubShader
    {
        Tags { "Queue"="Transparent" "RenderType"="Transparent" }
        Cull Off
        ZWrite Off
        ZTest LEqual
        Offset -1, -1
        Blend SrcAlpha OneMinusSrcAlpha
        Pass
        {
            CGPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #pragma multi_compile_fog
            #include "UnityCG.cginc"
            struct appdata { float4 vertex:POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; };
            struct v2f { float4 vertex:SV_POSITION; float2 uv:TEXCOORD0; fixed4 color:COLOR; UNITY_FOG_COORDS(1) };
            sampler2D _MainTex;
            v2f vert(appdata v)
            {
                v2f o; o.vertex=UnityObjectToClipPos(v.vertex); o.uv=v.uv; o.color=v.color;
                UNITY_TRANSFER_FOG(o,o.vertex); return o;
            }
            fixed4 frag(v2f i):SV_Target
            {
                fixed4 c=i.color; c.a*=tex2D(_MainTex,i.uv).a;
                UNITY_APPLY_FOG(i.fogCoord,c); return c;
            }
            ENDCG
        }
    }
}
