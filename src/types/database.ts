
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
            "categories": {
                  Row: {
                    "icon": string | null,"id": number,"name": string,"parent_id": number | null,"slug": string,"sort_order": number
                  }
                  ComputedFields: never
                  Insert: {
                    "icon"?: string | null,"id"?: never,"name": string,"parent_id"?: number | null,"slug": string,"sort_order"?: number
                  }
                  Update: {
                    "icon"?: string | null,"id"?: never,"name"?: string,"parent_id"?: number | null,"slug"?: string,"sort_order"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "categories_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    }
                  ]
                },"data_sharing_consents": {
                  Row: {
                    "created_at": string,"granted": boolean,"id": string,"policy_version": string,"purpose": Database["public"]['Enums']["consent_purpose"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"granted": boolean,"id"?: string,"policy_version": string,"purpose": Database["public"]['Enums']["consent_purpose"],"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"granted"?: boolean,"id"?: string,"policy_version"?: string,"purpose"?: Database["public"]['Enums']["consent_purpose"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"item_photos": {
                  Row: {
                    "created_at": string,"id": string,"item_id": string,"sort_order": number,"storage_path": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"item_id": string,"sort_order"?: number,"storage_path": string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"item_id"?: string,"sort_order"?: number,"storage_path"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "item_photos_item_id_fkey"
      columns: ["item_id"]
isOneToOne: false
      referencedRelation: "items"
      referencedColumns: ["id"]
    }
                  ]
                },"items": {
                  Row: {
                    "brand": string | null,"category_id": number | null,"color": string | null,"condition": Database["public"]['Enums']["item_condition"] | null,"created_at": string,"expires_at": string | null,"id": string,"jan_code": string | null,"location_id": string | null,"model_number": string | null,"name": string,"notes": string | null,"purchase_channel": Database["public"]['Enums']["purchase_channel"] | null,"purchase_price": number | null,"purchase_store": string | null,"purchased_at": string | null,"quantity": number,"size": string | null,"status": Database["public"]['Enums']["item_status"],"updated_at": string,"user_id": string,"warranty_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "brand"?: string | null,"category_id"?: number | null,"color"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"] | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"jan_code"?: string | null,"location_id"?: string | null,"model_number"?: string | null,"name": string,"notes"?: string | null,"purchase_channel"?: Database["public"]['Enums']["purchase_channel"] | null,"purchase_price"?: number | null,"purchase_store"?: string | null,"purchased_at"?: string | null,"quantity"?: number,"size"?: string | null,"status"?: Database["public"]['Enums']["item_status"],"updated_at"?: string,"user_id"?: string,"warranty_until"?: string | null
                  }
                  Update: {
                    "brand"?: string | null,"category_id"?: number | null,"color"?: string | null,"condition"?: Database["public"]['Enums']["item_condition"] | null,"created_at"?: string,"expires_at"?: string | null,"id"?: string,"jan_code"?: string | null,"location_id"?: string | null,"model_number"?: string | null,"name"?: string,"notes"?: string | null,"purchase_channel"?: Database["public"]['Enums']["purchase_channel"] | null,"purchase_price"?: number | null,"purchase_store"?: string | null,"purchased_at"?: string | null,"quantity"?: number,"size"?: string | null,"status"?: Database["public"]['Enums']["item_status"],"updated_at"?: string,"user_id"?: string,"warranty_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "items_category_id_fkey"
      columns: ["category_id"]
isOneToOne: false
      referencedRelation: "categories"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "items_location_id_fkey"
      columns: ["location_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"location_layouts": {
                  Row: {
                    "color": string | null,"created_at": string,"depth_cm": number,"elevation_cm": number,"height_cm": number,"location_id": string,"rotation_deg": number,"source": string,"updated_at": string,"user_id": string,"width_cm": number,"x_cm": number,"z_cm": number
                  }
                  ComputedFields: never
                  Insert: {
                    "color"?: string | null,"created_at"?: string,"depth_cm": number,"elevation_cm"?: number,"height_cm": number,"location_id": string,"rotation_deg"?: number,"source"?: string,"updated_at"?: string,"user_id"?: string,"width_cm": number,"x_cm"?: number,"z_cm"?: number
                  }
                  Update: {
                    "color"?: string | null,"created_at"?: string,"depth_cm"?: number,"elevation_cm"?: number,"height_cm"?: number,"location_id"?: string,"rotation_deg"?: number,"source"?: string,"updated_at"?: string,"user_id"?: string,"width_cm"?: number,"x_cm"?: number,"z_cm"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "location_layouts_location_id_fkey"
      columns: ["location_id"]
isOneToOne: true
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"locations": {
                  Row: {
                    "created_at": string,"id": string,"kind": Database["public"]['Enums']["location_kind"],"name": string,"parent_id": string | null,"sort_order": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["location_kind"],"name": string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"kind"?: Database["public"]['Enums']["location_kind"],"name"?: string,"parent_id"?: string | null,"sort_order"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "locations_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "locations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "birth_year": number | null,"created_at": string,"display_name": string | null,"gender": string | null,"id": string,"prefecture": string | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "birth_year"?: number | null,"created_at"?: string,"display_name"?: string | null,"gender"?: string | null,"id": string,"prefecture"?: string | null,"updated_at"?: string
                  }
                  Update: {
                    "birth_year"?: number | null,"created_at"?: string,"display_name"?: string | null,"gender"?: string | null,"id"?: string,"prefecture"?: string | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "current_consents": {
                  Row: {
                    "created_at": string | null,"granted": boolean | null,"policy_version": string | null,"purpose": Database["public"]['Enums']["consent_purpose"] | null,"user_id": string | null
                  }
                  ComputedFields: never
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "consent_purpose": "anonymized_analytics"|"third_party_provision"|"resale_offers","item_condition": "new"|"like_new"|"good"|"fair"|"poor","item_status": "owned"|"listed"|"sold"|"disposed"|"given_away","location_kind": "home"|"room"|"closet"|"shelf"|"drawer"|"box"|"bag"|"wallet"|"other","purchase_channel": "store"|"online"|"gift"|"secondhand"|"other"
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
            "consent_purpose": ["anonymized_analytics", "third_party_provision", "resale_offers"],"item_condition": ["new", "like_new", "good", "fair", "poor"],"item_status": ["owned", "listed", "sold", "disposed", "given_away"],"location_kind": ["home", "room", "closet", "shelf", "drawer", "box", "bag", "wallet", "other"],"purchase_channel": ["store", "online", "gift", "secondhand", "other"]
          }
        }
} as const
