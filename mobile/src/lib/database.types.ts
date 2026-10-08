
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "assignments": {
                  Row: {
                    "driver_id": string,"fim_em": string | null,"id": string,"inicio_em": string,"km_fim": number | null,"km_inicio": number,"status": Database["public"]['Enums']["status_vinculo"],"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "driver_id": string,"fim_em"?: string | null,"id"?: string,"inicio_em"?: string,"km_fim"?: number | null,"km_inicio": number,"status"?: Database["public"]['Enums']["status_vinculo"],"vehicle_id": string
                  }
                  Update: {
                    "driver_id"?: string,"fim_em"?: string | null,"id"?: string,"inicio_em"?: string,"km_fim"?: number | null,"km_inicio"?: number,"status"?: Database["public"]['Enums']["status_vinculo"],"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "assignments_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "assignments_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"fipe_cache": {
                  Row: {
                    "atualizado_em": string,"chave": string,"dados": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "atualizado_em"?: string,"chave": string,"dados": NonNullable<Json>
                  }
                  Update: {
                    "atualizado_em"?: string,"chave"?: string,"dados"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"fleet_members": {
                  Row: {
                    "criado_em": string,"driver_id": string,"fleet_id": string,"id": string,"nivel_manutencao": Database["public"]['Enums']["nivel_manutencao"],"status": Database["public"]['Enums']["status_membro"]
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"driver_id": string,"fleet_id": string,"id"?: string,"nivel_manutencao"?: Database["public"]['Enums']["nivel_manutencao"],"status"?: Database["public"]['Enums']["status_membro"]
                  }
                  Update: {
                    "criado_em"?: string,"driver_id"?: string,"fleet_id"?: string,"id"?: string,"nivel_manutencao"?: Database["public"]['Enums']["nivel_manutencao"],"status"?: Database["public"]['Enums']["status_membro"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "fleet_members_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "fleet_members_fleet_id_fkey"
      columns: ["fleet_id"]
isOneToOne: false
      referencedRelation: "fleets"
      referencedColumns: ["id"]
    }
                  ]
                },"fleets": {
                  Row: {
                    "cidade": string | null,"codigo_convite": string,"criada_em": string,"id": string,"limiar_amarelo_dias": number,"limiar_amarelo_km": number,"limiar_laranja_km": number,"limite_salto_km_dia": number,"modo_manutencao": Database["public"]['Enums']["modo_manutencao"],"nome": string,"owner_id": string,"uf": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cidade"?: string | null,"codigo_convite": string,"criada_em"?: string,"id"?: string,"limiar_amarelo_dias"?: number,"limiar_amarelo_km"?: number,"limiar_laranja_km"?: number,"limite_salto_km_dia"?: number,"modo_manutencao"?: Database["public"]['Enums']["modo_manutencao"],"nome": string,"owner_id": string,"uf"?: string | null
                  }
                  Update: {
                    "cidade"?: string | null,"codigo_convite"?: string,"criada_em"?: string,"id"?: string,"limiar_amarelo_dias"?: number,"limiar_amarelo_km"?: number,"limiar_laranja_km"?: number,"limite_salto_km_dia"?: number,"modo_manutencao"?: Database["public"]['Enums']["modo_manutencao"],"nome"?: string,"owner_id"?: string,"uf"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "fleets_owner_id_fkey"
      columns: ["owner_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"incident_photos": {
                  Row: {
                    "capturado_em": string,"id": string,"incident_id": string,"path": string,"recebido_em": string
                  }
                  ComputedFields: never
                  Insert: {
                    "capturado_em": string,"id"?: string,"incident_id": string,"path": string,"recebido_em"?: string
                  }
                  Update: {
                    "capturado_em"?: string,"id"?: string,"incident_id"?: string,"path"?: string,"recebido_em"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incident_photos_incident_id_fkey"
      columns: ["incident_id"]
isOneToOne: false
      referencedRelation: "incidents"
      referencedColumns: ["id"]
    }
                  ]
                },"incidents": {
                  Row: {
                    "criada_em": string,"descricao": string,"driver_id": string,"id": string,"resolvida_em": string | null,"status": Database["public"]['Enums']["status_ocorrencia"],"tipo": Database["public"]['Enums']["tipo_ocorrencia"],"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criada_em"?: string,"descricao": string,"driver_id": string,"id"?: string,"resolvida_em"?: string | null,"status"?: Database["public"]['Enums']["status_ocorrencia"],"tipo": Database["public"]['Enums']["tipo_ocorrencia"],"vehicle_id": string
                  }
                  Update: {
                    "criada_em"?: string,"descricao"?: string,"driver_id"?: string,"id"?: string,"resolvida_em"?: string | null,"status"?: Database["public"]['Enums']["status_ocorrencia"],"tipo"?: Database["public"]['Enums']["tipo_ocorrencia"],"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "incidents_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "incidents_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"inspection_photos": {
                  Row: {
                    "assignment_id": string,"capturado_em": string,"id": string,"momento": Database["public"]['Enums']["momento_foto"],"path": string,"posicao": Database["public"]['Enums']["posicao_foto"],"recebido_em": string
                  }
                  ComputedFields: never
                  Insert: {
                    "assignment_id": string,"capturado_em": string,"id"?: string,"momento": Database["public"]['Enums']["momento_foto"],"path": string,"posicao": Database["public"]['Enums']["posicao_foto"],"recebido_em"?: string
                  }
                  Update: {
                    "assignment_id"?: string,"capturado_em"?: string,"id"?: string,"momento"?: Database["public"]['Enums']["momento_foto"],"path"?: string,"posicao"?: Database["public"]['Enums']["posicao_foto"],"recebido_em"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "inspection_photos_assignment_id_fkey"
      columns: ["assignment_id"]
isOneToOne: false
      referencedRelation: "assignments"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_catalog": {
                  Row: {
                    "custo_sugerido": number | null,"id": string,"intervalo_km": number | null,"intervalo_meses": number | null,"nome": string,"ordem": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "custo_sugerido"?: number | null,"id"?: string,"intervalo_km"?: number | null,"intervalo_meses"?: number | null,"nome": string,"ordem"?: number | null
                  }
                  Update: {
                    "custo_sugerido"?: number | null,"id"?: string,"intervalo_km"?: number | null,"intervalo_meses"?: number | null,"nome"?: string,"ordem"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"maintenance_record_items": {
                  Row: {
                    "id": string,"nome_outro": string | null,"record_id": string,"valor": number | null,"vehicle_item_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"nome_outro"?: string | null,"record_id": string,"valor"?: number | null,"vehicle_item_id"?: string | null
                  }
                  Update: {
                    "id"?: string,"nome_outro"?: string | null,"record_id"?: string,"valor"?: number | null,"vehicle_item_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_record_items_record_id_fkey"
      columns: ["record_id"]
isOneToOne: false
      referencedRelation: "maintenance_records"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_record_items_vehicle_item_id_fkey"
      columns: ["vehicle_item_id"]
isOneToOne: false
      referencedRelation: "vehicle_items"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_records": {
                  Row: {
                    "autor_id": string,"criado_em": string,"data": string,"id": string,"km": number,"motivo": string | null,"nota_foto_path": string | null,"oficina": string | null,"request_id": string | null,"revisado_em": string | null,"revisado_por": string | null,"status": Database["public"]['Enums']["status_servico"],"valor_total": number,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id": string,"criado_em"?: string,"data": string,"id"?: string,"km": number,"motivo"?: string | null,"nota_foto_path"?: string | null,"oficina"?: string | null,"request_id"?: string | null,"revisado_em"?: string | null,"revisado_por"?: string | null,"status": Database["public"]['Enums']["status_servico"],"valor_total": number,"vehicle_id": string
                  }
                  Update: {
                    "autor_id"?: string,"criado_em"?: string,"data"?: string,"id"?: string,"km"?: number,"motivo"?: string | null,"nota_foto_path"?: string | null,"oficina"?: string | null,"request_id"?: string | null,"revisado_em"?: string | null,"revisado_por"?: string | null,"status"?: Database["public"]['Enums']["status_servico"],"valor_total"?: number,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_records_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_records_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "maintenance_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_records_revisado_por_fkey"
      columns: ["revisado_por"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_records_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"maintenance_requests": {
                  Row: {
                    "criado_em": string,"driver_id": string,"id": string,"itens": (string)[],"observacao": string | null,"prazo": string,"prazo_notificado": boolean,"status": Database["public"]['Enums']["status_pedido"],"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "criado_em"?: string,"driver_id": string,"id"?: string,"itens": (string)[],"observacao"?: string | null,"prazo": string,"prazo_notificado"?: boolean,"status"?: Database["public"]['Enums']["status_pedido"],"vehicle_id": string
                  }
                  Update: {
                    "criado_em"?: string,"driver_id"?: string,"id"?: string,"itens"?: (string)[],"observacao"?: string | null,"prazo"?: string,"prazo_notificado"?: boolean,"status"?: Database["public"]['Enums']["status_pedido"],"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "maintenance_requests_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "maintenance_requests_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "corpo": string,"criada_em": string,"id": string,"lida": boolean,"prioridade": string,"push_enviado_em": string | null,"ref_id": string | null,"ref_tabela": string | null,"tipo": string,"titulo": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "corpo": string,"criada_em"?: string,"id"?: string,"lida"?: boolean,"prioridade"?: string,"push_enviado_em"?: string | null,"ref_id"?: string | null,"ref_tabela"?: string | null,"tipo": string,"titulo": string,"user_id": string
                  }
                  Update: {
                    "corpo"?: string,"criada_em"?: string,"id"?: string,"lida"?: boolean,"prioridade"?: string,"push_enviado_em"?: string | null,"ref_id"?: string | null,"ref_tabela"?: string | null,"tipo"?: string,"titulo"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"odometer_readings": {
                  Row: {
                    "autor_id": string,"capturado_em": string,"foto_painel_path": string | null,"id": string,"km": number,"origem": Database["public"]['Enums']["origem_km"],"recebido_em": string,"salto_suspeito": boolean,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "autor_id": string,"capturado_em": string,"foto_painel_path"?: string | null,"id"?: string,"km": number,"origem": Database["public"]['Enums']["origem_km"],"recebido_em"?: string,"salto_suspeito"?: boolean,"vehicle_id": string
                  }
                  Update: {
                    "autor_id"?: string,"capturado_em"?: string,"foto_painel_path"?: string | null,"id"?: string,"km"?: number,"origem"?: Database["public"]['Enums']["origem_km"],"recebido_em"?: string,"salto_suspeito"?: boolean,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "odometer_readings_autor_id_fkey"
      columns: ["autor_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "odometer_readings_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "cidade": string | null,"cpf": string | null,"criado_em": string,"expo_push_token": string | null,"id": string,"nome": string,"papel": Database["public"]['Enums']["papel_usuario"],"telefone": string | null,"tem_cnh": boolean,"uf": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "cidade"?: string | null,"cpf"?: string | null,"criado_em"?: string,"expo_push_token"?: string | null,"id": string,"nome": string,"papel": Database["public"]['Enums']["papel_usuario"],"telefone"?: string | null,"tem_cnh"?: boolean,"uf"?: string | null
                  }
                  Update: {
                    "cidade"?: string | null,"cpf"?: string | null,"criado_em"?: string,"expo_push_token"?: string | null,"id"?: string,"nome"?: string,"papel"?: Database["public"]['Enums']["papel_usuario"],"telefone"?: string | null,"tem_cnh"?: boolean,"uf"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"vehicle_items": {
                  Row: {
                    "ativo": boolean,"catalog_id": string | null,"custo_estimado": number,"data_inicial": string | null,"id": string,"intervalo_km": number | null,"intervalo_meses": number | null,"km_inicial": number | null,"nome": string,"status_atual": Database["public"]['Enums']["status_item"],"ultima_data": string | null,"ultimo_km": number | null,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "ativo"?: boolean,"catalog_id"?: string | null,"custo_estimado"?: number,"data_inicial"?: string | null,"id"?: string,"intervalo_km"?: number | null,"intervalo_meses"?: number | null,"km_inicial"?: number | null,"nome": string,"status_atual"?: Database["public"]['Enums']["status_item"],"ultima_data"?: string | null,"ultimo_km"?: number | null,"vehicle_id": string
                  }
                  Update: {
                    "ativo"?: boolean,"catalog_id"?: string | null,"custo_estimado"?: number,"data_inicial"?: string | null,"id"?: string,"intervalo_km"?: number | null,"intervalo_meses"?: number | null,"km_inicial"?: number | null,"nome"?: string,"status_atual"?: Database["public"]['Enums']["status_item"],"ultima_data"?: string | null,"ultimo_km"?: number | null,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_items_catalog_id_fkey"
      columns: ["catalog_id"]
isOneToOne: false
      referencedRelation: "maintenance_catalog"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_items_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicle_visibility": {
                  Row: {
                    "driver_id": string,"vehicle_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "driver_id": string,"vehicle_id": string
                  }
                  Update: {
                    "driver_id"?: string,"vehicle_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicle_visibility_driver_id_fkey"
      columns: ["driver_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vehicle_visibility_vehicle_id_fkey"
      columns: ["vehicle_id"]
isOneToOne: false
      referencedRelation: "vehicles"
      referencedColumns: ["id"]
    }
                  ]
                },"vehicles": {
                  Row: {
                    "ano_modelo": number,"ativo": boolean,"cor": string,"criado_em": string,"em_uso": boolean,"exige_aprovacao_sempre": boolean,"fipe_codigo": string | null,"fleet_id": string,"id": string,"km_atual": number,"km_dia_estimado": number,"marca": string,"modelo": string,"placa": string,"visibilidade": Database["public"]['Enums']["visibilidade_carro"]
                  }
                  ComputedFields: never
                  Insert: {
                    "ano_modelo": number,"ativo"?: boolean,"cor": string,"criado_em"?: string,"em_uso"?: boolean,"exige_aprovacao_sempre"?: boolean,"fipe_codigo"?: string | null,"fleet_id": string,"id"?: string,"km_atual": number,"km_dia_estimado"?: number,"marca": string,"modelo": string,"placa": string,"visibilidade"?: Database["public"]['Enums']["visibilidade_carro"]
                  }
                  Update: {
                    "ano_modelo"?: number,"ativo"?: boolean,"cor"?: string,"criado_em"?: string,"em_uso"?: boolean,"exige_aprovacao_sempre"?: boolean,"fipe_codigo"?: string | null,"fleet_id"?: string,"id"?: string,"km_atual"?: number,"km_dia_estimado"?: number,"marca"?: string,"modelo"?: string,"placa"?: string,"visibilidade"?: Database["public"]['Enums']["visibilidade_carro"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "vehicles_fleet_id_fkey"
      columns: ["fleet_id"]
isOneToOne: false
      referencedRelation: "fleets"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "atualizar_item":
{ Args: { "p_aplicar_em_todos": boolean,"p_custo_estimado": number,"p_intervalo_km": number,"p_intervalo_meses": number,"p_item_id": string }; Returns: number
                           },
"cancelar_pedido":
{ Args: { "p_request_id": string }; Returns: {
              "criado_em": string,
"driver_id": string,
"id": string,
"itens": (string)[],
"observacao": string | null,
"prazo": string,
"prazo_notificado": boolean,
"status": Database["public"]['Enums']["status_pedido"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "maintenance_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"cancelar_retirada":
{ Args: { "p_assignment_id": string }; Returns: {
              "driver_id": string,
"fim_em": string | null,
"id": string,
"inicio_em": string,
"km_fim": number | null,
"km_inicio": number,
"status": Database["public"]['Enums']["status_vinculo"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"carros_para_mim":
{ Args: Record<PropertyKey, never>; Returns: {
              "ano_modelo": number,"cor": string,"em_uso": boolean,"foto_path": string,"marca": string,"modelo": string,"placa": string,"vehicle_id": string
            }[]
                           },
"concluir_retirada":
{ Args: { "p_assignment_id": string }; Returns: {
              "driver_id": string,
"fim_em": string | null,
"id": string,
"inicio_em": string,
"km_fim": number | null,
"km_inicio": number,
"status": Database["public"]['Enums']["status_vinculo"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"cpf_valido":
{ Args: { "p": string }; Returns: boolean
                           },
"criar_frota":
{ Args: { "p_nome": string }; Returns: {
              "cidade": string | null,
"codigo_convite": string,
"criada_em": string,
"id": string,
"limiar_amarelo_dias": number,
"limiar_amarelo_km": number,
"limiar_laranja_km": number,
"limite_salto_km_dia": number,
"modo_manutencao": Database["public"]['Enums']["modo_manutencao"],
"nome": string,
"owner_id": string,
"uf": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "fleets"
        isOneToOne: true
        isSetofReturn: false
      } },
"criar_pedido":
{ Args: { "p_itens": (string)[],"p_observacao"?: string,"p_prazo": string,"p_vehicle_id": string }; Returns: {
              "criado_em": string,
"driver_id": string,
"id": string,
"itens": (string)[],
"observacao": string | null,
"prazo": string,
"prazo_notificado": boolean,
"status": Database["public"]['Enums']["status_pedido"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "maintenance_requests"
        isOneToOne: true
        isSetofReturn: false
      } },
"custo_medio_item":
{ Args: { "p_item_id": string }; Returns: number
                           },
"definir_historico_inicial":
{ Args: { "p_data_inicial": string,"p_item_id": string,"p_km_inicial": number }; Returns: {
              "ativo": boolean,
"catalog_id": string | null,
"custo_estimado": number,
"data_inicial": string | null,
"id": string,
"intervalo_km": number | null,
"intervalo_meses": number | null,
"km_inicial": number | null,
"nome": string,
"status_atual": Database["public"]['Enums']["status_item"],
"ultima_data": string | null,
"ultimo_km": number | null,
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "vehicle_items"
        isOneToOne: true
        isSetofReturn: false
      } },
"definir_visibilidade":
{ Args: { "p_modo": Database["public"]['Enums']["visibilidade_carro"],"p_motoristas"?: (string)[],"p_vehicle_id": string }; Returns: undefined
                           },
"devolver_carro":
{ Args: { "p_assignment_id": string,"p_capturado_em"?: string,"p_foto_painel_path"?: string,"p_km": number }; Returns: {
              "driver_id": string,
"fim_em": string | null,
"id": string,
"inicio_em": string,
"km_fim": number | null,
"km_inicio": number,
"status": Database["public"]['Enums']["status_vinculo"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"e_dono_do_motorista":
{ Args: { "p_driver_id": string }; Returns: boolean
                           },
"e_dono_do_veiculo":
{ Args: { "p_vehicle_id": string }; Returns: boolean
                           },
"e_dono_frota":
{ Args: { "p_fleet_id": string }; Returns: boolean
                           },
"e_membro_ativo":
{ Args: { "p_fleet_id": string }; Returns: boolean
                           },
"e_membro_do_dono":
{ Args: { "p_owner_id": string }; Returns: boolean
                           },
"entrar_na_frota":
{ Args: { "p_codigo": string }; Returns: {
              "criado_em": string,
"driver_id": string,
"fleet_id": string,
"id": string,
"nivel_manutencao": Database["public"]['Enums']["nivel_manutencao"],
"status": Database["public"]['Enums']["status_membro"]
            }
                          SetofOptions: {
        from: "*"
        to: "fleet_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"erro":
{ Args: { "p_codigo": string,"p_detalhe": string }; Returns: undefined
                           },
"exigir_fotos_inspecao":
{ Args: { "p_assignment_id": string,"p_momento": Database["public"]['Enums']["momento_foto"] }; Returns: undefined
                           },
"fleet_id_do_objeto":
{ Args: { "p_name": string }; Returns: string
                           },
"fmt_km":
{ Args: { "p_km": number }; Returns: string
                           },
"foto_valida":
{ Args: { "p_fleet_id": string,"p_path": string,"p_vehicle_id": string }; Returns: boolean
                           },
"gastos_realizados":
{ Args: { "p_dias": number,"p_fleet_id": string,"p_hoje"?: string }; Returns: {
              "data": string,"itens": (string)[],"placa": string,"record_id": string,"valor_total": number,"vehicle_id": string
            }[]
                           },
"gerar_codigo_convite":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"gerar_novo_codigo":
{ Args: { "p_fleet_id": string }; Returns: string
                           },
"hoje_brt":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"iniciar_retirada":
{ Args: { "p_capturado_em"?: string,"p_foto_painel_path"?: string,"p_km": number,"p_vehicle_id": string }; Returns: {
              "driver_id": string,
"fim_em": string | null,
"id": string,
"inicio_em": string,
"km_fim": number | null,
"km_inicio": number,
"status": Database["public"]['Enums']["status_vinculo"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "assignments"
        isOneToOne: true
        isSetofReturn: false
      } },
"media_km_dia_interna":
{ Args: { "p_hoje": string,"p_vehicle_id": string }; Returns: {
              "estimada": boolean,"media": number
            }[]
                           },
"normalizar_cidade":
{ Args: { "p": string }; Returns: string
                           },
"notificar":
{ Args: { "p_corpo": string,"p_prioridade"?: string,"p_ref_id"?: string,"p_ref_tabela"?: string,"p_tipo": string,"p_titulo": string,"p_user_id": string }; Returns: undefined
                           },
"permissao_registro":
{ Args: { "p_request_id"?: string,"p_vehicle_id": string }; Returns: string
                           },
"pode_ver_carro":
{ Args: { "p_driver_id": string,"p_vehicle_id": string }; Returns: boolean
                           },
"previsao_itens":
{ Args: { "p_hoje"?: string,"p_vehicle_id": string }; Returns: {
              "custo_estimado": number,"data_prevista": string,"km_restante": number,"nome": string,"proximo_km": number,"status": Database["public"]['Enums']["status_item"],"vehicle_item_id": string
            }[]
                           },
"previsao_itens_interna":
{ Args: { "p_hoje": string,"p_vehicle_id": string }; Returns: {
              "custo_estimado": number,"data_prevista": string,"km_restante": number,"nome": string,"proximo_km": number,"status": Database["public"]['Enums']["status_item"],"vehicle_item_id": string
            }[]
                           },
"projecao_gastos":
{ Args: { "p_dias": number,"p_fleet_id": string,"p_hoje"?: string }; Returns: {
              "data": string,"item_nome": string,"placa": string,"valor": number,"vehicle_id": string,"vehicle_item_id": string
            }[]
                           },
"recalcular_itens_do_servico":
{ Args: { "p_record_id": string }; Returns: undefined
                           },
"recalcular_ultima_troca":
{ Args: { "p_item_id": string }; Returns: undefined
                           },
"registrar_km":
{ Args: { "p_capturado_em"?: string,"p_foto_painel_path"?: string,"p_km": number,"p_origem"?: Database["public"]['Enums']["origem_km"],"p_vehicle_id": string }; Returns: {
              "autor_id": string,
"capturado_em": string,
"foto_painel_path": string | null,
"id": string,
"km": number,
"origem": Database["public"]['Enums']["origem_km"],
"recebido_em": string,
"salto_suspeito": boolean,
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "odometer_readings"
        isOneToOne: true
        isSetofReturn: false
      } },
"registrar_servico":
{ Args: { "p_data": string,"p_foto_painel_path"?: string,"p_itens": Json,"p_km": number,"p_nota_foto_path"?: string,"p_oficina"?: string,"p_request_id"?: string,"p_valor_total": number,"p_vehicle_id": string }; Returns: {
              "autor_id": string,
"criado_em": string,
"data": string,
"id": string,
"km": number,
"motivo": string | null,
"nota_foto_path": string | null,
"oficina": string | null,
"request_id": string | null,
"revisado_em": string | null,
"revisado_por": string | null,
"status": Database["public"]['Enums']["status_servico"],
"valor_total": number,
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "maintenance_records"
        isOneToOne: true
        isSetofReturn: false
      } },
"relatar_ocorrencia":
{ Args: { "p_descricao": string,"p_tipo": Database["public"]['Enums']["tipo_ocorrencia"],"p_vehicle_id": string }; Returns: {
              "criada_em": string,
"descricao": string,
"driver_id": string,
"id": string,
"resolvida_em": string | null,
"status": Database["public"]['Enums']["status_ocorrencia"],
"tipo": Database["public"]['Enums']["tipo_ocorrencia"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "incidents"
        isOneToOne: true
        isSetofReturn: false
      } },
"remover_motorista":
{ Args: { "p_member_id": string }; Returns: {
              "criado_em": string,
"driver_id": string,
"fleet_id": string,
"id": string,
"nivel_manutencao": Database["public"]['Enums']["nivel_manutencao"],
"status": Database["public"]['Enums']["status_membro"]
            }
                          SetofOptions: {
        from: "*"
        to: "fleet_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"resolver_ocorrencia":
{ Args: { "p_incident_id": string }; Returns: {
              "criada_em": string,
"descricao": string,
"driver_id": string,
"id": string,
"resolvida_em": string | null,
"status": Database["public"]['Enums']["status_ocorrencia"],
"tipo": Database["public"]['Enums']["tipo_ocorrencia"],
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "incidents"
        isOneToOne: true
        isSetofReturn: false
      } },
"responder_entrada":
{ Args: { "p_aprovar": boolean,"p_member_id": string }; Returns: {
              "criado_em": string,
"driver_id": string,
"fleet_id": string,
"id": string,
"nivel_manutencao": Database["public"]['Enums']["nivel_manutencao"],
"status": Database["public"]['Enums']["status_membro"]
            }
                          SetofOptions: {
        from: "*"
        to: "fleet_members"
        isOneToOne: true
        isSetofReturn: false
      } },
"resumo_frota":
{ Args: { "p_fleet_id": string,"p_hoje"?: string }; Returns: {
              "estimada": boolean,"marca": string,"modelo": string,"motorista_nome": string,"placa": string,"proxima_data": string,"proximo_item": string,"status": Database["public"]['Enums']["status_item"],"vehicle_id": string
            }[]
                           },
"revisar_servico":
{ Args: { "p_decisao": string,"p_motivo"?: string,"p_record_id": string }; Returns: {
              "autor_id": string,
"criado_em": string,
"data": string,
"id": string,
"km": number,
"motivo": string | null,
"nota_foto_path": string | null,
"oficina": string | null,
"request_id": string | null,
"revisado_em": string | null,
"revisado_por": string | null,
"status": Database["public"]['Enums']["status_servico"],
"valor_total": number,
"vehicle_id": string
            }
                          SetofOptions: {
        from: "*"
        to: "maintenance_records"
        isOneToOne: true
        isSetofReturn: false
      } },
"rotina_diaria":
{ Args: { "p_hoje"?: string }; Returns: undefined
                           },
"status_carro":
{ Args: { "p_hoje"?: string,"p_vehicle_id": string }; Returns: {
              "estimada": boolean,"media": number,"proxima_data": string,"proximo_item": string,"status": Database["public"]['Enums']["status_item"]
            }[]
                           },
"status_carro_interna":
{ Args: { "p_hoje": string,"p_vehicle_id": string }; Returns: {
              "estimada": boolean,"media": number,"proxima_data": string,"proximo_item": string,"status": Database["public"]['Enums']["status_item"]
            }[]
                           },
"tem_vinculo_ativo":
{ Args: { "p_vehicle_id": string }; Returns: boolean
                           },
"vehicle_id_do_objeto":
{ Args: { "p_name": string }; Returns: string
                           }
          }
          Enums: {
            "modo_manutencao": "proprietario_leva"|"motoristas_levam","momento_foto": "retirada"|"devolucao","nivel_manutencao": "sem_permissao"|"com_aprovacao"|"confiavel","origem_km": "retirada"|"devolucao"|"atualizacao"|"manutencao"|"correcao_dono","papel_usuario": "proprietario"|"motorista","posicao_foto": "frente"|"traseira"|"lateral_esq"|"lateral_dir"|"extra","status_item": "sem_historico"|"vencido"|"urgente"|"proximo"|"em_dia","status_membro": "pendente"|"ativo"|"removido","status_ocorrencia": "aberta"|"resolvida","status_pedido": "aberto"|"concluido"|"cancelado","status_servico": "pendente"|"aprovado"|"recusado"|"contestado","status_vinculo": "aguardando_fotos"|"ativo"|"encerrado","tipo_ocorrencia": "mecanico"|"acidente_leve"|"acidente_grave"|"outro","visibilidade_carro": "todos"|"alguns"|"um"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "modo_manutencao": ["proprietario_leva", "motoristas_levam"],"momento_foto": ["retirada", "devolucao"],"nivel_manutencao": ["sem_permissao", "com_aprovacao", "confiavel"],"origem_km": ["retirada", "devolucao", "atualizacao", "manutencao", "correcao_dono"],"papel_usuario": ["proprietario", "motorista"],"posicao_foto": ["frente", "traseira", "lateral_esq", "lateral_dir", "extra"],"status_item": ["sem_historico", "vencido", "urgente", "proximo", "em_dia"],"status_membro": ["pendente", "ativo", "removido"],"status_ocorrencia": ["aberta", "resolvida"],"status_pedido": ["aberto", "concluido", "cancelado"],"status_servico": ["pendente", "aprovado", "recusado", "contestado"],"status_vinculo": ["aguardando_fotos", "ativo", "encerrado"],"tipo_ocorrencia": ["mecanico", "acidente_leve", "acidente_grave", "outro"],"visibilidade_carro": ["todos", "alguns", "um"]
          }
        }
} as const
